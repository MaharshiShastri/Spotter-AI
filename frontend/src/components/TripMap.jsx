import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Paper, Typography, Box, Alert } from '@mui/material';

export default function TripMap({ waypoints }) {
    // 1. Guard against empty datasets. Do not plot placeholder defaults!
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
        return (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Waiting for OpenStreetMap input strings to generate route rendering tokens...
            </Alert>
        );
    }

    // 2. Derive map viewport directly from the dynamically requested geocodes
    const firstPoint = waypoints[0];
    if (!firstPoint || typeof firstPoint.lat !== 'number' || typeof firstPoint.lng !== 'number') {
        return (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
                Invalid geolocation parameters parsed from routing coordinates.
            </Alert>
        );
    }

    const mapCenter = [firstPoint.lat, firstPoint.lng];
    const routePositions = waypoints.map(w => [w.lat, w.lng]);

    return (
        <Paper elevation={1} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5, color: '#1e293b' }}>
                Operational Geocoded Transit Corridor Map
            </Typography>
            <Box sx={{ height: '400px', width: '100%', borderRadius: 2, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                    />
                    {waypoints.map((point, index) => {
                        if (typeof point.lat !== 'number' || typeof point.lng !== 'number') return null;
                        return (
                            <Marker key={index} position={[point.lat, point.lng]}>
                                <Popup>
                                    <div style={{ fontFamily: 'sans-serif' }}>
                                        <strong style={{ color: '#2563eb' }}>{point.name || 'Waypoint Location'}</strong>
                                        <br /> Stop Marker #{index + 1}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                    <Polyline positions={routePositions} color="#2563eb" weight={5} dashArray="2, 8" />
                </MapContainer>
            </Box>
        </Paper>
    );
}