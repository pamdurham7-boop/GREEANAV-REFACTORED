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

        if (dbUrl == null) dbUrl = "jdbc:mysql://localhost:3306/my_app_db";
        if (dbUser == null) dbUser = "db_user";
        if (dbPass == null) dbPass = "secure_db_password";
        int port = (portStr != null) ? Integer.parseInt(portStr) : 8080;

        System.out.println("Connecting to MySQL at " + dbUrl + "...");

        Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
        Statement stmt = conn.createStatement();
        
        // CHANGED: Added username and password columns to the table schema
        stmt.execute("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), username VARCHAR(255) UNIQUE, password VARCHAR(255))");
        
        // Exposing ONLY the necessary port for communication
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        
        // CHANGED: Replacing HTML routes with JSON API endpoints
        server.createContext("/login", new AuthController(conn, "login"));
        server.createContext("/register", new AuthController(conn, "register"));
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
                return;
            }

            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            // Read JSON Body
            String body = new String(exchange.getRequestBody().readAllBytes());
            String username = extractJsonValue(body, "username");
            String password = extractJsonValue(body, "password");

            try {
                if ("login".equals(action)) {
                    PreparedStatement pstmt = conn.prepareStatement("SELECT id FROM users WHERE username = ? AND password = ?");
                    pstmt.setString(1, username);
                    pstmt.setString(2, password);
                    ResultSet rs = pstmt.executeQuery();
                    
                    if (rs.next()) {
                        sendJsonResponse(exchange, 200, "{\"status\":\"success\"}");
                    } else {
                        sendJsonResponse(exchange, 401, "{\"status\":\"error\"}");
                    }
                } else if ("register".equals(action)) {
                    String fullName = extractJsonValue(body, "fullName");
                    PreparedStatement pstmt = conn.prepareStatement("INSERT INTO users (name, username, password) VALUES (?, ?, ?)");
                    pstmt.setString(1, fullName);
                    pstmt.setString(2, username);
                    pstmt.setString(3, password);
                    pstmt.executeUpdate();
                    
                    sendJsonResponse(exchange, 200, "{\"status\":\"success\"}");
                }
            } catch (SQLException e) {
                // Fails securely if the username already exists (UNIQUE constraint)
                sendJsonResponse(exchange, 400, "{\"status\":\"error\"}");
            }
        }

        private void sendJsonResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(statusCode, response.length());
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }

        // A simple string parser to extract JSON variables without external libraries
        private String extractJsonValue(String json, String key) {
            String search = "\"" + key + "\":\"";
            int start = json.indexOf(search);
            if (start == -1) return null;
            start += search.length();
            int end = json.indexOf("\"", start);
            if (end == -1) return null;
            return json.substring(start, end);
        }
    }
}