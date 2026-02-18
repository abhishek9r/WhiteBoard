# 🚀 Getting Started — LiveBoard Setup Guide

This guide walks you through setting up the LiveBoard application from scratch on a Windows PC with **nothing pre-installed**.

---

## Step 1 — Install Java 17 (JDK)

1. Go to: **https://adoptium.net/temurin/releases/?version=17**
2. Select: **Windows → x64 → JDK → `.msi`**
3. Download and run the installer. Accept all defaults.
4. Verify installation by opening a new **Command Prompt** or **PowerShell** and running:
   ```
   java -version
   ```
   You should see: `openjdk version "17.x.x"`

---

## Step 2 — Install Maven

1. Go to: **https://maven.apache.org/download.cgi**
2. Download the **Binary zip archive** (e.g., `apache-maven-3.9.x-bin.zip`)
3. Extract it to `C:\Program Files\Maven\`
4. Add Maven to your PATH:
   - Open **Start → Search "Environment Variables"**
   - Under **System Variables**, find `Path` → click **Edit**
   - Click **New** → add: `C:\Program Files\Maven\apache-maven-3.9.x\bin`
   - Click OK on all dialogs
5. Verify in a **new** terminal:
   ```
   mvn -version
   ```

---

## Step 3 — Install Docker Desktop

Docker is used to run PostgreSQL without installing it directly on your machine.

1. Go to: **https://www.docker.com/products/docker-desktop/**
2. Download **Docker Desktop for Windows**
3. Run the installer (requires a restart)
4. After restart, open **Docker Desktop** from the Start menu and wait for it to say **"Engine running"**
5. Verify in a terminal:
   ```
   docker --version
   ```

---

## Step 4 — Start the Database

Open a terminal in the project folder (`d:\Projects\Whiteboard\WhiteBoard`) and run:

```bash
docker-compose up -d
```

This downloads PostgreSQL and starts it in the background. You only need to do this once.

To verify it's running:
```bash
docker ps
```
You should see `whiteboard_postgres` listed.

---

## Step 5 — Run the Application

In the same project folder, run:

```bash
mvn spring-boot:run
```

Maven will download all dependencies on the first run (~2-3 minutes). Subsequent starts are fast (~5 seconds).

You should see:
```
Started WhiteboardApplication in X.XXX seconds
```

---

## Step 6 — Open the Whiteboard

Open your browser and go to:

```
http://localhost:8080
```

To test multi-user collaboration:
- Open the same URL in a **second browser tab** (or a different browser)
- Draw in one tab — you'll see it appear in the other in real-time ✨

---

## Stopping the Application

- Press `Ctrl+C` in the terminal to stop the Spring Boot server
- To stop the database: `docker-compose down`
- To stop the database AND delete all data: `docker-compose down -v`

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `java: command not found` | Restart your terminal after installing Java |
| `mvn: command not found` | Restart your terminal after adding Maven to PATH |
| `Connection refused` on port 5432 | Make sure Docker Desktop is running and you ran `docker-compose up -d` |
| Port 8080 already in use | Change `server.port=8080` to `server.port=8081` in `application.properties` |
| Maven downloads are slow | First run downloads ~100MB of dependencies; subsequent runs are instant |
