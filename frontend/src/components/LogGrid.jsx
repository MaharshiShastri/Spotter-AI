import React from 'react';
import { Paper, Typography, Box, Grid } from '@mui/material';

const STATUS_ROWS = {
  OFF_DUTY: 0,
  SLEEPER_BERTH: 1,
  DRIVING: 2,
  ON_DUTY: 3,
};

const ROW_HEIGHT = 35;
const HOUR_WIDTH = 28;
const PADDING_LEFT = 120; 
const TOTAL_GRID_WIDTH = HOUR_WIDTH * 24;
const TOTAL_GRID_HEIGHT = ROW_HEIGHT * 4;
const PADDING_TOP = 30;

// Normalizes cumulative absolute timestamps (e.g. Hour 26 for Day 2) to standard 24-hr layout positions
const parseTimeStr = (timeStr) => {
  if (!timeStr) return { hrs: 0, mins: 0 };
  const parts = timeStr.split(':').map(Number);
  let hrs = parts[0] || 0;
  const mins = parts[1] || 0;
  
  hrs = hrs % 24; 
  return { hrs, mins };
};
const visualStatus = (segment) => {
  const remarkText = segment.remark || '';
  
  // Force visual line down to OFF_DUTY for final wrap-up sequences
  if (segment.status === 'ON_DUTY' && remarkText.includes('Unloading & Post-Trip Checkout Complete')) {
    return 'OFF_DUTY';
  }
  
  return segment.status;
};
const timeToX = (timeStr) => {
  const { hrs, mins } = parseTimeStr(timeStr);
  return PADDING_LEFT + (hrs * HOUR_WIDTH) + ((mins / 60) * HOUR_WIDTH);
};

const getRowY = (status) => {
  const rowIndex = STATUS_ROWS[status] !== undefined ? STATUS_ROWS[status] : 0;
  return PADDING_TOP + (rowIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
};

export default function LogGrid({ dayLabel, logSegments }) {
  const hourlyTotals = { OFF_DUTY: 0, SLEEPER_BERTH: 0, DRIVING: 0, ON_DUTY: 0 };
  
  if (logSegments && Array.isArray(logSegments)) {
    logSegments.forEach(s => {
      if (hourlyTotals[s.status] !== undefined) {
        hourlyTotals[s.status] += s.duration_mins / 60;
      }
    });
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 3, border: '1px solid #e0e0e0' }}>
      <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mb: 2 }}>
        {dayLabel} - 24-Hour Graph Grid Log
      </Typography>

      <Box sx={{ overflowX: 'auto', py: 1 }}>
        <svg width={PADDING_LEFT + TOTAL_GRID_WIDTH + 80} height={PADDING_TOP + TOTAL_GRID_HEIGHT + 40}>
          {/* 1. Draw Grid Background Lines */}
          {Object.keys(STATUS_ROWS).map((status, index) => (
            <g key={status}>
              <text x="10" y={PADDING_TOP + (index * ROW_HEIGHT) + 22} style={{ fontSize: '11px', fontWeight: 600, fill: '#666' }}>
                {status.replace('_', ' ')}
              </text>
              <line 
                x1={PADDING_LEFT} 
                y1={PADDING_TOP + (index * ROW_HEIGHT) + ROW_HEIGHT} 
                x2={PADDING_LEFT + TOTAL_GRID_WIDTH} 
                y2={PADDING_TOP + (index * ROW_HEIGHT) + ROW_HEIGHT} 
                stroke="#ccc" 
                strokeWidth="1" 
              />
            </g>
          ))}

          {/* 2. Draw Hour Vertical Ticks */}
          {Array.from({ length: 25 }).map((_, hour) => {
            const xPos = PADDING_LEFT + (hour * HOUR_WIDTH);
            return (
              <g key={hour}>
                <line 
                  x1={xPos} 
                  y1={PADDING_TOP} 
                  x2={xPos} 
                  y2={PADDING_TOP + TOTAL_GRID_HEIGHT} 
                  stroke={hour % 4 === 0 ? "#999" : "#eee"}
                  strokeWidth={hour % 4 === 0 ? "1.5" : "1"}
                />
                {hour < 24 && (
                  <text x={xPos - 4} y={PADDING_TOP - 8} style={{ fontSize: '10px', fill: '#999', fontWeight: 500 }}>
                    {hour}
                  </text>
                )}
              </g>
            );
          })}

          {/* 3. Draw Total Hours Summary Columns */}
          <text x={PADDING_LEFT + TOTAL_GRID_WIDTH + 20} y={PADDING_TOP - 8} style={{ fontSize: '11px', fontWeight: 'bold', fill: '#444' }}>TOTAL</text>
          {Object.keys(STATUS_ROWS).map((status, index) => (
            <text 
              key={status}
              x={PADDING_LEFT + TOTAL_GRID_WIDTH + 25} 
              y={PADDING_TOP + (index * ROW_HEIGHT) + 22} 
              style={{ fontSize: '12px', fontWeight: 700, fill: '#1976d2' }}
            >
              {hourlyTotals[status].toFixed(1)}
            </text>
          ))}

          {/* 4. Draw Driver's Plot Timeline Graph Line */}
          {logSegments && logSegments.map((segment, idx) => {
            const startX = timeToX(segment.start);
            const rowY = getRowY(segment.status);
            
            const { hrs: startHrs, mins: startMins } = parseTimeStr(segment.start);
            const totalStartMins = (startHrs * 60) + startMins;
            let totalEndMins = totalStartMins + segment.duration_mins;

            // Prevent lines from bleeding out of the current day's graph boundary bounds (1440 mins = 24 hours)
            if (totalEndMins > 1440) {
              totalEndMins = 1440;
            }

            const endHrs = Math.floor(totalEndMins / 60);
            const endMins = totalEndMins % 60;
            const endX = PADDING_LEFT + (endHrs * HOUR_WIDTH) + ((endMins / 60) * HOUR_WIDTH);

            const nextSegment = logSegments[idx + 1];
            const nextY = nextSegment ? getRowY(nextSegment.status) : null;

            return (
              <g key={idx}>
                <line x1={startX} y1={rowY} x2={endX} y2={rowY} stroke="#d32f2f" strokeWidth="3.5" strokeLinecap="round" />
                {nextSegment && rowY !== nextY && (
                  <line x1={endX} y1={rowY} x2={endX} y2={nextY} stroke="#d32f2f" strokeWidth="2" strokeDasharray="3,3" />
                )}
              </g>
            );
          })}
        </svg>
      </Box>

      {/* Modernized layout blocks leveraging valid MUI v6 grid syntax configurations */}
      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #f0f0f0' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#555' }}>Remarks & Flag Annotations:</Typography>
        <Grid container spacing={2}>
          {logSegments && logSegments.map((segment, idx) => (
            <Grid key={idx} size={{ xs: 12, sm: 6, md: 4 }}>
              <Typography variant="caption" display="block" sx={{ color: '#666' }}>
                <strong>{segment.start}</strong> ({segment.duration_mins}m) - <span style={{color: '#1976d2'}}>{visualStatus(segment)}</span>: {segment.remark}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
}
