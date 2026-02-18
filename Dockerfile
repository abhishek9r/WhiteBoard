# Stage 1: Build the JAR using official Maven + JDK image
FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn clean package -DskipTests -q

# Stage 2: Run with a slim JRE only
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/whiteboard-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Xmx400m", "-jar", "app.jar"]
