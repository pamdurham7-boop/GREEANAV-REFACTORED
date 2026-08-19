# Use an official Java development image
FROM eclipse-temurin:21-jdk

# Set the working directory inside the container
WORKDIR /app

# Download the MySQL JDBC Driver directly from Maven Central
RUN wget https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/8.3.0/mysql-connector-j-8.3.0.jar

# Copy MvcApp.java from your local "java" subfolder into /app inside the container
COPY ./MvcApp.java .

# Compile MvcApp.java into MvcApp.class inside /app
RUN javac MvcApp.java

# Expose the internal port for Docker Compose documentation
EXPOSE 8080

# Run the compiled class name "MvcApp"
CMD ["java", "-cp", ".:mysql-connector-j-8.3.0.jar", "MvcApp"]