import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

public class MvcApp {

    public static void main(String[] args) throws Exception {
        String dbUrl = System.getenv("SPRING_DATASOURCE_URL");
        String dbUser = System.getenv("SPRING_DATASOURCE_USERNAME");
        String dbPass = System.getenv("SPRING_DATASOURCE_PASSWORD");
        String portStr = System.getenv("SERVER_PORT");
        // Shared secret the ESP32 firmware must send in the X-Device-Key
        // header on every /report POST. This is separate from the
        // Cloudflare Access Service Token: Access protects the tunnel,
        // this key is checked by this application itself.
        String deviceKey = System.getenv("DEVICE_SHARED_KEY");

        if (dbUrl == null) dbUrl = "jdbc:mysql://localhost:3306/my_app_db";
        if (dbUser == null) dbUser = "db_user";
        if (dbPass == null) dbPass = "secure_db_password";
        if (deviceKey == null) deviceKey = "CHANGE_ME_DEVICE_SHARED_KEY"; // <-- CHANGE THIS, must match the .ino
        int port = (portStr != null) ? Integer.parseInt(portStr) : 8080;

        System.out.println("Connecting to MySQL at " + dbUrl + "...");

        Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
        Statement stmt = conn.createStatement();
        
        // CHANGED: Added username and password columns to the table schema
        stmt.execute("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), username VARCHAR(255) UNIQUE, password VARCHAR(255))");

        // CHANGED: Latest known state per device. One row per device_id.
        // color/device_ts are upserted by ReportController (from the
        // ESP32). latitude/longitude are upserted separately by
        // DeviceLocationController (set by the frontend) -- the device
        // itself no longer reports a location, so these start out NULL
        // until the frontend sets them.
        stmt.execute("CREATE TABLE IF NOT EXISTS device_status (" +
                "device_id VARCHAR(64) PRIMARY KEY, " +
                "color VARCHAR(10) NOT NULL DEFAULT 'NONE', " +
                "latitude DOUBLE NULL, " +
                "longitude DOUBLE NULL, " +
                "device_ts BIGINT, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)");
        
        // Exposing ONLY the necessary port for communication
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        
        // CHANGED: Replacing HTML routes with JSON API endpoints
        server.createContext("/login", new AuthController(conn, "login"));
        server.createContext("/register", new AuthController(conn, "register"));
        // CHANGED: ESP32 posts sensor state here; frontend polls it back out
        server.createContext("/", new ReportController(conn));
        server.createContext("/signals", new SignalsController(conn));
        // NEW: frontend sets/updates a device's map coordinates here
        server.createContext("/device-location", new DeviceLocationController(conn));
        // NEW: lets the app dismiss a device's pin (App.tsx -> handleDeleteLocation)
        server.createContext("/delete", new DeleteController(conn));
        server.setExecutor(null);
        server.start();
        
        System.out.println("API Server is running on port: " + port);
    }

    // CHANGED: Added AuthController to handle JSON requests and CORS
    static class AuthController implements HttpHandler {
        private final Connection conn;
        private final String action;

        public AuthController(Connection conn, String action) {
            this.conn = conn;
            this.action = action;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Add CORS Headers so the React Native client can reach the Java server
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");

            // Handle preflight requests
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }

            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            // Read JSON Body
            String body = new String(exchange.getRequestBody().readAllBytes());
            String username = JsonUtil.extractValue(body, "username");
            String password = JsonUtil.extractValue(body, "password");

            try {
                if ("login".equals(action)) {
                    PreparedStatement pstmt = conn.prepareStatement("SELECT id FROM users WHERE username = ? AND password = ?");
                    pstmt.setString(1, username);
                    pstmt.setString(2, password);
                    ResultSet rs = pstmt.executeQuery();
                    
                    if (rs.next()) {
                        JsonUtil.sendJsonResponse(exchange, 200, "{\"status\":\"success\"}");
                    } else {
                        JsonUtil.sendJsonResponse(exchange, 401, "{\"status\":\"error\"}");
                    }
                } else if ("register".equals(action)) {
                    String fullName = JsonUtil.extractValue(body, "fullName");
                    PreparedStatement pstmt = conn.prepareStatement("INSERT INTO users (name, username, password) VALUES (?, ?, ?)");
                    pstmt.setString(1, fullName);
                    pstmt.setString(2, username);
                    pstmt.setString(3, password);
                    pstmt.executeUpdate();
                    
                    JsonUtil.sendJsonResponse(exchange, 200, "{\"status\":\"success\"}");
                }
            } catch (SQLException e) {
                // Fails securely if the username already exists (UNIQUE constraint)
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\"}");
            }
        }
    }

    // CHANGED: Receives sensor state from the ESP32 (via the Cloudflare
    // Tunnel). Validates the device key, validates the payload (including
    // re-checking the green/yellow/red chain server-side so a malformed or
    // tampered payload can't skip straight to yellow/red), then upserts the
    // device's current status. This validated upsert is the "approval" step
    // -- there is no human in the loop, a report either passes validation
    // and is published immediately, or it's rejected.
// CHANGED: Receives sensor state from the ESP32 (via the Cloudflare
    // Tunnel). Validates the payload (including re-checking the 
    // green/yellow/red chain server-side), then upserts the
    // device's current status.
    static class ReportController implements HttpHandler {
        private final Connection conn;

        public ReportController(Connection conn) {
            this.conn = conn;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            // Read the JSON payload from the ESP32
            String body = new String(exchange.getRequestBody().readAllBytes());
            String deviceId = JsonUtil.extractValue(body, "device_id");
            String greenStr = JsonUtil.extractValue(body, "green");
            String yellowStr = JsonUtil.extractValue(body, "yellow");
            String redStr = JsonUtil.extractValue(body, "red");
            String tsStr = JsonUtil.extractValue(body, "ts");

            if (deviceId == null || greenStr == null || yellowStr == null || redStr == null) {
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\",\"reason\":\"missing_fields\"}");
                return;
            }

            boolean green, yellow, red;
            long ts;
            try {
                green = "1".equals(greenStr) || "true".equalsIgnoreCase(greenStr);
                yellow = "1".equals(yellowStr) || "true".equalsIgnoreCase(yellowStr);
                red = "1".equals(redStr) || "true".equalsIgnoreCase(redStr);
                ts = (tsStr != null) ? Long.parseLong(tsStr) : System.currentTimeMillis();
            } catch (NumberFormatException e) {
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\",\"reason\":\"malformed_numbers\"}");
                return;
            }

            // Re-enforce the chain rule server-side.
            if (red && !yellow) {
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\",\"reason\":\"invalid_chain_red_without_yellow\"}");
                return;
            }
            if (yellow && !green) {
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\",\"reason\":\"invalid_chain_yellow_without_green\"}");
                return;
            }

            String color = red ? "RED" : yellow ? "YELLOW" : green ? "GREEN" : "NONE";

            try {
                PreparedStatement pstmt = conn.prepareStatement(
                        "INSERT INTO device_status (device_id, color, device_ts) " +
                        "VALUES (?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE color = VALUES(color), device_ts = VALUES(device_ts), " +
                        "updated_at = CURRENT_TIMESTAMP");
                pstmt.setString(1, deviceId);
                pstmt.setString(2, color);
                pstmt.setLong(3, ts);
                pstmt.executeUpdate();
                JsonUtil.sendJsonResponse(exchange, 200, "{\"status\":\"success\",\"color\":\"" + color + "\"}");
            } catch (SQLException e) {
                JsonUtil.sendJsonResponse(exchange, 500, "{\"status\":\"error\",\"reason\":\"db_error\"}");
            }
        }
    }

    // NEW: The frontend calls this to set or update a device's map
    // coordinates -- the ESP32 itself has no GPS module and no longer
    // sends location in its /report payload. Only latitude/longitude are
    // touched here; color and device_ts (owned by ReportController) are
    // left as they are, so setting a location doesn't clobber the
    // device's last known signal state.
    static class DeviceLocationController implements HttpHandler {
        private final Connection conn;

        public DeviceLocationController(Connection conn) {
            this.conn = conn;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            String body = new String(exchange.getRequestBody().readAllBytes());
            String deviceId = JsonUtil.extractValue(body, "deviceId");
            String latStr = JsonUtil.extractValue(body, "latitude");
            String lonStr = JsonUtil.extractValue(body, "longitude");

            if (deviceId == null || deviceId.trim().isEmpty() || latStr == null || lonStr == null) {
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\",\"reason\":\"missing_fields\"}");
                return;
            }

            double lat, lon;
            try {
                lat = Double.parseDouble(latStr);
                lon = Double.parseDouble(lonStr);
            } catch (NumberFormatException e) {
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\",\"reason\":\"malformed_numbers\"}");
                return;
            }
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat == 0.0 && lon == 0.0)) {
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\",\"reason\":\"invalid_coordinates\"}");
                return;
            }

            try {
                // If the device hasn't sent a /report yet, this creates the
                // row with the default color 'NONE'; ReportController's
                // upsert later leaves latitude/longitude untouched.
                PreparedStatement pstmt = conn.prepareStatement(
                        "INSERT INTO device_status (device_id, latitude, longitude) VALUES (?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude), " +
                        "updated_at = CURRENT_TIMESTAMP");
                pstmt.setString(1, deviceId);
                pstmt.setDouble(2, lat);
                pstmt.setDouble(3, lon);
                pstmt.executeUpdate();
                JsonUtil.sendJsonResponse(exchange, 200, "{\"status\":\"success\"}");
            } catch (SQLException e) {
                JsonUtil.sendJsonResponse(exchange, 500, "{\"status\":\"error\",\"reason\":\"db_error\"}");
            }
        }
    }

    // CHANGED: Frontend polls this to get the current, already-validated
    // state of every device -- this is what feeds the pie chart and the
    // colored map pins. A device only shows up once it has BOTH an active
    // color (from /report) AND a location on file (from
    // /device-location) -- a signal with nowhere to put it on the map
    // isn't useful to the frontend yet.
    static class SignalsController implements HttpHandler {
        private final Connection conn;

        public SignalsController(Connection conn) {
            this.conn = conn;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, OPTIONS");

            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            StringBuilder json = new StringBuilder("[");
            try {
                PreparedStatement pstmt = conn.prepareStatement(
                        "SELECT device_id, color, latitude, longitude, device_ts FROM device_status " +
                        "WHERE color <> 'NONE' AND latitude IS NOT NULL AND longitude IS NOT NULL");
                ResultSet rs = pstmt.executeQuery();
                boolean first = true;
                while (rs.next()) {
                    if (!first) json.append(",");
                    first = false;
                    String deviceId = rs.getString("device_id");
                    json.append("{")
                        .append("\"id\":\"").append(JsonUtil.escape(deviceId)).append("\",")
                        .append("\"deviceId\":\"").append(JsonUtil.escape(deviceId)).append("\",")
                        .append("\"color\":\"").append(rs.getString("color")).append("\",")
                        .append("\"location\":{")
                            .append("\"latitude\":").append(rs.getDouble("latitude")).append(",")
                            .append("\"longitude\":").append(rs.getDouble("longitude"))
                        .append("},")
                        .append("\"timestamp\":").append(rs.getLong("device_ts"))
                        .append("}");
                }
            } catch (SQLException e) {
                JsonUtil.sendJsonResponse(exchange, 500, "{\"status\":\"error\"}");
                return;
            }
            json.append("]");
            JsonUtil.sendJsonResponse(exchange, 200, json.toString());
        }
    }

    // NEW: The app calls this when the user taps "Delete" on a red/yellow
    // location in the dropdown (App.tsx -> handleDeleteLocation). It removes
    // that device's row outright, so the next /signals poll no longer
    // includes it and its map pin disappears. This is app-side dismissal,
    // not device authentication, so it does not check X-Device-Key -- only
    // /report (writes coming from the ESP32 itself) does.
    static class DeleteController implements HttpHandler {
        private final Connection conn;

        public DeleteController(Connection conn) {
            this.conn = conn;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            String body = new String(exchange.getRequestBody().readAllBytes());
            String deviceId = JsonUtil.extractValue(body, "deviceId");

            if (deviceId == null || deviceId.trim().isEmpty()) {
                JsonUtil.sendJsonResponse(exchange, 400, "{\"status\":\"error\",\"reason\":\"missing_device_id\"}");
                return;
            }

            try {
                PreparedStatement pstmt = conn.prepareStatement("DELETE FROM device_status WHERE device_id = ?");
                pstmt.setString(1, deviceId);
                pstmt.executeUpdate();
                JsonUtil.sendJsonResponse(exchange, 200, "{\"status\":\"success\"}");
            } catch (SQLException e) {
                JsonUtil.sendJsonResponse(exchange, 500, "{\"status\":\"error\",\"reason\":\"db_error\"}");
            }
        }
    }

    // Small shared helpers so every controller parses/writes JSON the same
    // way, without pulling in an external JSON library.
    static class JsonUtil {
        static void sendJsonResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
            byte[] bytes = response.getBytes("UTF-8");
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(statusCode, bytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(bytes);
            os.close();
        }

        // Extracts a JSON value by key. Handles both quoted strings
        // ("key":"value") and bare numbers/booleans ("key":1, "key":true).
        static String extractValue(String json, String key) {
            String search = "\"" + key + "\":";
            int start = json.indexOf(search);
            if (start == -1) return null;
            start += search.length();
            while (start < json.length() && Character.isWhitespace(json.charAt(start))) start++;
            if (start >= json.length()) return null;

            if (json.charAt(start) == '"') {
                start++;
                int end = json.indexOf('"', start);
                if (end == -1) return null;
                return json.substring(start, end);
            }

            int end = start;
            while (end < json.length() && json.charAt(end) != ',' && json.charAt(end) != '}'
                    && !Character.isWhitespace(json.charAt(end))) {
                end++;
            }
            return json.substring(start, end);
        }

        static String escape(String s) {
            if (s == null) return "";
            return s.replace("\\", "\\\\").replace("\"", "\\\"");
        }
    }
}