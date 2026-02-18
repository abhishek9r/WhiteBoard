package com.example.whiteboard.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Data Transfer Object for stroke messages sent over WebSocket.
 * Decoupled from the JPA entity to avoid serialization issues.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrokeDTO {

    /** CSS color string */
    private String color;

    /** Brush size in pixels */
    private float lineWidth;

    /**
     * List of [x, y] coordinate pairs.
     * Example: [[10.0, 20.0], [15.0, 25.0]]
     */
    private List<double[]> points;

    /** "pen" or "eraser" */
    private String tool;
}
