package com.example.whiteboard.controller;

import com.example.whiteboard.model.StrokeDTO;
import com.example.whiteboard.service.StrokeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WhiteboardController {

    private final StrokeService strokeService;

    /**
     * Handles strokes sent by any client to /app/draw.
     * 1. Persists the stroke asynchronously (non-blocking).
     * 2. Broadcasts the stroke to ALL subscribers on /topic/board.
     *
     * The broadcast happens BEFORE the DB write completes, ensuring
     * minimum latency for real-time sync. The @Async persistence
     * runs in a separate thread pool.
     */
    @MessageMapping("/draw")
    @SendTo("/topic/board")
    public StrokeDTO handleDraw(StrokeDTO strokeDTO) {
        log.debug("Received stroke: color={}, points={}", strokeDTO.getColor(),
                strokeDTO.getPoints() != null ? strokeDTO.getPoints().size() : 0);
        strokeService.persistStroke(strokeDTO);
        return strokeDTO;
    }

    /**
     * Handles board clear events from any client.
     * Clears the DB and broadcasts a null/clear signal to all clients.
     */
    @MessageMapping("/clear")
    @SendTo("/topic/board-clear")
    public String handleClear() {
        log.info("Board clear requested");
        strokeService.clearBoard();
        return "CLEAR";
    }
}
