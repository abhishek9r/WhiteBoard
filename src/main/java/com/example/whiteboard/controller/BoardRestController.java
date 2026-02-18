package com.example.whiteboard.controller;

import com.example.whiteboard.model.StrokeDTO;
import com.example.whiteboard.service.StrokeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/board")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BoardRestController {

    private final StrokeService strokeService;

    /**
     * Returns the full board history for new users joining.
     * Called once on page load to replay all existing strokes.
     */
    @GetMapping("/history")
    public ResponseEntity<List<StrokeDTO>> getHistory() {
        List<StrokeDTO> strokes = strokeService.getAllStrokes();
        return ResponseEntity.ok(strokes);
    }

    /**
     * Clears the board via REST (e.g., admin action).
     */
    @DeleteMapping("/clear")
    public ResponseEntity<Void> clearBoard() {
        strokeService.clearBoard();
        return ResponseEntity.noContent().build();
    }
}
