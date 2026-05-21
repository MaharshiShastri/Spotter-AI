import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, AppBar, Toolbar, Typography, Box, TextField, Button, 
  Grid, Card, CardContent, CircularProgress, Alert, MenuItem, 
  List, ListItem, ListItemText, Divider, CardActionArea, Chip, Paper, Tab, Tabs,
  Fab, IconButton
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import HistoryIcon from '@mui/icons-material/History';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import CancelScheduleSendIcon from '@mui/icons-material/CancelScheduleSend';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MapIcon from '@mui/icons-material/Map';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CloseIcon from '@mui/icons-material/Close';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'; 
import LogGrid from './components/LogGrid';
import TripMap from './components/TripMap';
import AddressAutocomplete from './components/AddressAutocomplete';

// =========================================================================
// SINGLE LINE SUB-COMPONENT ACTION BAR (HYDRATED WITH AUTOCOMPLETE)
// =========================================================================
function ActionControlBar({ onCalculate, onReset, onDetectLocation, geoLoading, formState, setFormState, loading }) {
  return (
    <Box 
      component="form" 
      onSubmit={(e) => { e.preventDefault(); onCalculate(); }}
      sx={{ 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 1.5, 
        flexWrap: 'nowrap', 
        width: '100%',
        p: 2,
        bgcolor: '#ffffff',
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        mb: 3,
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
      }}
    >
      {/* 1. Origin Address with Autocomplete Option */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1.2 }}>
        <AddressAutocomplete
          label="Origin Address"
          value={formState.current_location}
          onChange={(val) => setFormState(prev => ({ ...prev, current_location: val }))}
        />
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={onDetectLocation} 
          disabled={geoLoading} 
          sx={{ height: 40, minWidth: 40, p: 0, borderRadius: 1.5 }}
        >
          {geoLoading ? <CircularProgress size={16} /> : <MyLocationIcon fontSize="small" />}
        </Button>
      </Box>
      
      {/* 2. Pickup Cargo Terminal - Upgraded from basic TextField */}
      <Box sx={{ flex: 1 }}>
        <AddressAutocomplete
          label="Pickup Cargo Terminal"
          value={formState.pickup_location}
          onChange={(val) => setFormState(prev => ({ ...prev, pickup_location: val }))}
        />
      </Box>
      
      {/* 3. Delivery Destination - Upgraded from basic TextField */}
      <Box sx={{ flex: 1 }}>
        <AddressAutocomplete
          label="Delivery Destination"
          value={formState.dropoff_location}
          onChange={(val) => setFormState(prev => ({ ...prev, dropoff_location: val }))}
        />
      </Box>

      <Box sx={{ width: '130px' }}>
        <TextField
          fullWidth
          label="Used Cycle"
          variant="outlined"
          size="small"
          type="number"
          placeholder="e.g. 14.5"
          value={formState.cycle_used}
          onChange={(e) => setFormState({ ...formState, cycle_used: e.target.value })}
        />
      </Box>

      <Box sx={{ width: '140px' }}>
        <TextField
          select
          fullWidth
          label="Start Time"
          variant="outlined"
          size="small"
          value={formState.start_time || '06:00'}
          onChange={(e) => setFormState({ ...formState, start_time: e.target.value })}
        >
          <MenuItem value="05:00">05:00 AM</MenuItem>
          <MenuItem value="06:00">06:00 AM</MenuItem>
          <MenuItem value="07:00">07:00 AM</MenuItem>
          <MenuItem value="08:00">08:00 AM</MenuItem>
          <MenuItem value="09:00">09:00 AM</MenuItem>
          <MenuItem value="10:00">10:00 AM</MenuItem>
        </TextField>
      </Box>

      <Button 
        type="submit"
        variant="contained" 
        color="primary" 
        size="medium"
        disabled={loading}
        sx={{ whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'none', borderRadius: 2, height: 40 }}
      >
        {loading ? <CircularProgress size={18} color="inherit" /> : 'Create Route'}
      </Button>
      
      <Button 
        variant="outlined" 
        color="error" 
        size="medium"
        onClick={onReset}
        sx={{ whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'none', borderRadius: 2, height: 40 }}
      >
        Reset Grid
      </Button>
    </Box>
  );
}

// =========================================================================
// MAIN APP ARCHITECTURE
// =========================================================================
export default function App() {
  const [currentPage, setCurrentPage] = useState('setup');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const defaultFormState = {
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    cycle_used: '',
    start_time: '06:00'
  };

  const [formData, setFormData] = useState(defaultFormState);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [tripResult, setTripResult] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [manualStatus, setManualStatus] = useState('OFF_DUTY');
  const [manualRemark, setManualRemark] = useState('');
  const [liveLogMessage, setLiveLogMessage] = useState(null);

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Hello! I am your Fleet HOS Assistant. Ask me anything about your current shift or historical dispatches.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
    
  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/trip-history/`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Historical fetch connection dropped: ", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const handleDeleteTrip = async (tripId, event) => {
    if (event) event.stopPropagation();
    
    if (!window.confirm("Are you sure you want to permanently delete this trip and purge its entire HOS log record?")) {
      return;
    }

    try {
      const response = await fetch(`/api/delete-trip/${tripId}/`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (tripResult && tripResult.id === tripId) {
          setTripResult(null);
          setCurrentPage('setup');
        }
        fetchHistory();
      } else {
        const data = await response.json();
        setError(data.message || "Failed to delete the selected trip from database infrastructure.");
      }
    } catch (err) {
      console.error("Error communicating with delete endpoint: ", err);
      setError("Network execution block dropped during database purge.");
    }
  };

  const handleSetupNewTrip = () => {
    setTripResult(null);
    setFormData(defaultFormState);
    setError(null);
    setCurrentPage('setup');
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation operations are not supported by this device browser core.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({
          ...prev,
          current_location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        }));
        setGeoLoading(false);
      },
      () => {
        setError("Unable to retrieve device physical location coordinates.");
        setGeoLoading(false);
      }
    );
  };

  const handleCalculateTrip = async () => {
    if (!formData.current_location || !formData.pickup_location || !formData.dropoff_location) {
      setError("Please fill out all location inputs before running optimization routines.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/calculate-trip/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_location: formData.current_location,
          pickup_location: formData.pickup_location,
          dropoff_location: formData.dropoff_location,
          cycle_used: formData.cycle_used || '0',
          start_time: formData.start_time || '06:00'
        }),
      });
      if (!response.ok) throw new Error('Failed to compute compliant route variables.');
      
      const data = await response.json();
      
      setTripResult({
        id: data.trip_id,
        is_completed: false,
        distance_miles: data.distance_miles,
        estimated_driving_time_hours: data.estimated_driving_time_hours,
        logs_by_day: data.logs_by_day || {},
        waypoints: data.waypoints || []
      });
      
      await fetchHistory();
      setCurrentPage('active_trip'); 
    } catch (err) {
      setError(err.message);
    } finally {
      // FIXED TYPO HERE: Changed "finaly" to "finally"
      setLoading(false);
    }
  };

  const handlePostManualLog = async (statusOverride, customRemark) => {
    const statusToSend = statusOverride || manualStatus;
    const remarkToSend = customRemark || manualRemark;
    
    try {
      const response = await fetch(`/api/manual-log/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: statusToSend, 
          remark: remarkToSend,
          trip_id: tripResult?.id 
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setLiveLogMessage(`Success! Updated to [${data.status}]`);
        setManualRemark('');
        
        if (tripResult) {
          const updatedLogs = { ...tripResult.logs_by_day };
          const daysArray = Object.keys(updatedLogs);
          const finalDayKey = daysArray[daysArray.length - 1] || 'Day 1';
          
          if (!updatedLogs[finalDayKey]) updatedLogs[finalDayKey] = [];

          updatedLogs[finalDayKey].push({
            status: data.status === 'END_TRIP' ? 'OFF_DUTY' : data.status,
            start: data.time ? data.time.substring(0, 5) : '00:00',
            duration_mins: 30,
            remark: `[Manual Update] ${data.remark}`
          });
          
          setTripResult({ 
            ...tripResult, 
            is_completed: statusToSend === 'END_TRIP' ? true : tripResult.is_completed,
            logs_by_day: updatedLogs 
          });
        }
        fetchHistory();
        setTimeout(() => setLiveLogMessage(null), 4000);
      }
    } catch (err) {
      console.error("Could not upload shift status lines: ", err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch(`/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history_context: history
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        throw new Error();
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Error connecting to processing nodes.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f8fafc', position: 'relative' }}>
      <AppBar position="sticky" sx={{ bgcolor: '#0f172a', boxShadow: 3 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={handleSetupNewTrip}>
            <LocalShippingIcon sx={{ mr: 1.5, color: '#38bdf8' }} />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '0.5px' }}>
              SPOTTER AI <span style={{ fontWeight: 300, color: '#94a3b8' }}>| HOS Dispatch</span>
            </Typography>
          </Box>
          
          <Tabs 
            value={currentPage} 
            onChange={(e, val) => setCurrentPage(val)} 
            textColor="inherit" 
            indicatorColor="primary"
            sx={{
              '& .MuiTabs-indicator': { bgcolor: '#38bdf8', height: 3 },
              '& .MuiTab-root': { fontWeight: 700, fontSize: '14px', px: 3 }
            }}
          >
            <Tab label="Plan Route" value="setup" icon={<AddIcon fontSize="small"/>} iconPosition="start" />
            <Tab label="Active Tracking" value="active_trip" disabled={!tripResult} icon={<MapIcon fontSize="small"/>} iconPosition="start" />
            <Tab label="Filing Archives" value="history" icon={<HistoryIcon fontSize="small"/>} iconPosition="start" />
          </Tabs>

          <Button variant="contained" color="info" startIcon={<AddIcon />} onClick={handleSetupNewTrip} sx={{ fontWeight: 700, borderRadius: 2, bgcolor: '#0284c7' }}>
            Clear & Reset Form
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 5, pb: 8 }}>
        
        {/* PAGE 1 */}
        {currentPage === 'setup' && (
          <Box sx={{ width: '100%', mx: 'auto' }}>
            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
            
            <ActionControlBar 
              formState={formData}
              setFormState={setFormData}
              onCalculate={handleCalculateTrip}
              onReset={handleSetupNewTrip}
              onDetectLocation={handleDetectLocation}
              geoLoading={geoLoading}
              loading={loading}
            />
          </Box>
        )}

        {/* PAGE 2 */}
        {currentPage === 'active_trip' && tripResult && (
          <Grid container spacing={4}>
            <Grid item xs={12} md={8}>
              {tripResult.is_completed && (
                <Alert severity="success" icon={<LocalShippingIcon />} sx={{ mb: 3, fontWeight: 700, borderRadius: 2 }}>
                  This itinerary route is securely closed out and archived. Manual alterations are disabled.
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center', borderRadius: 3, bgcolor: '#f0f9ff', borderColor: '#bae6fd' }}>
                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800 }}>MAPPED RUNNING DISTANCE</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#0369a1' }}>{tripResult.distance_miles} mi</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center', borderRadius: 3, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <Typography variant="caption" sx={{ color: '#166534', fontWeight: 800 }}>PROJECTED COMPLIANT DURATION</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#166534' }}>{tripResult.estimated_driving_time_hours} hrs</Typography>
                </Paper>
              </Box>

              <Box sx={{ mb: 4 }}>
                <TripMap waypoints={tripResult.waypoints} />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color="action"/> Dynamic ELD Timeline Charts (Trip Reference #{tripResult.id})
              </Typography>
              
              {Object.keys(tripResult.logs_by_day || {}).map((dayKey) => (
                <LogGrid key={dayKey} dayLabel={dayKey} logSegments={tripResult.logs_by_day[dayKey]} />
              ))}
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', position: 'sticky', top: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: '#1e293b' }}>
                    Status Modification Console
                  </Typography>
                  {liveLogMessage && <Alert severity="success" sx={{ mb: 2, py: 0 }}>{liveLogMessage}</Alert>}
                  
                  <Box component="form" onSubmit={(e) => { e.preventDefault(); handlePostManualLog(); }} sx={{ mb: 2 }}>
                    <TextField 
                      select 
                      fullWidth 
                      label="Select Log Line Status" 
                      value={manualStatus} 
                      onChange={(e) => setManualStatus(e.target.value)} 
                      disabled={!!tripResult.is_completed}
                      sx={{ mb: 2 }}
                    >
                      <MenuItem value="OFF_DUTY">Off Duty</MenuItem>
                      <MenuItem value="SLEEPER_BERTH">Sleeper Berth</MenuItem>
                      <MenuItem value="DRIVING">Driving</MenuItem>
                      <MenuItem value="ON_DUTY">On Duty (Not Driving)</MenuItem>
                    </TextField>
                    <TextField 
                      fullWidth 
                      label="Log Remark Annotation" 
                      placeholder="e.g. Mandatory Pre-Trip Preflight check" 
                      value={manualRemark} 
                      onChange={(e) => setManualRemark(e.target.value)} 
                      disabled={!!tripResult.is_completed}
                      sx={{ mb: 2 }} 
                    />
                    <Button 
                      type="submit" 
                      variant="outlined" 
                      color="primary" 
                      fullWidth 
                      endIcon={<SendIcon />} 
                      disabled={!!tripResult.is_completed}
                      sx={{ fontWeight: 700, borderRadius: 2 }}
                    >
                      Log Status Shift
                    </Button>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Button 
                    fullWidth 
                    variant="contained" 
                    color={tripResult.is_completed ? "inherit" : "error"} 
                    size="large"
                    disabled={!!tripResult.is_completed}
                    startIcon={<CancelScheduleSendIcon />}
                    onClick={() => handlePostManualLog('END_TRIP', 'Arrived at destination hub. Driver signoff complete.')}
                    sx={{ fontWeight: 800, py: 1.4, borderRadius: 2, mb: 2 }}
                  >
                    {tripResult.is_completed ? "Trip Finished & Archived" : "END DISPATCH RUN & FILE"}
                  </Button>

                  <Button
                    fullWidth
                    variant="text"
                    color="error"
                    startIcon={<DeleteForeverIcon />}
                    onClick={() => handleDeleteTrip(tripResult.id)}
                    sx={{ fontWeight: 700, '&:hover': { bgcolor: '#fef2f2' } }}
                  >
                    Delete Trip Ledger
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* PAGE 3 */}
        {currentPage === 'history' && (
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 3, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryIcon color="action" /> Locked Carrier Log History
                </Typography>
                <List disablePadding>
                  {history.length === 0 && (
                    <Typography variant="body1" color="textSecondary" sx={{ py: 4, textAlign: 'center' }}>
                      No previous dispatches found on local network storage nodes.
                    </Typography>
                  )}
                  {history.map((trip, idx) => (
                    <Box key={trip.id || idx}>
                      <CardActionArea sx={{ borderRadius: 2, my: 0.5 }} onClick={() => {
                        setTripResult({
                          id: trip.id,
                          is_completed: trip.is_completed || false,
                          distance_miles: trip.distance,
                          estimated_driving_time_hours: (trip.distance / 55).toFixed(1),
                          logs_by_day: trip.logs_by_day || {},
                          waypoints: trip.waypoints || []
                        });
                        setFormData({
                          current_location: trip.origin || '',
                          pickup_location: trip.pickup || '',
                          dropoff_location: trip.dropoff || '',
                          cycle_used: '',
                          start_time: '06:00'
                        });
                        setCurrentPage('active_trip'); 
                      }}>
                        <ListItem secondaryAction={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Chip label={trip.is_completed ? "Archived" : "Active"} color={trip.is_completed ? "default" : "success"} variant="filled" size="small" />
                            <IconButton edge="end" aria-label="delete" color="error" onClick={(e) => handleDeleteTrip(trip.id, e)}>
                              <DeleteForeverIcon />
                            </IconButton>
                          </Box>
                        } sx={{ py: 2 }}>
                          <ListItemText 
                            primary={<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{trip.pickup ? trip.pickup.split(',')[0] : 'Unknown'} → {trip.dropoff ? trip.dropoff.split(',')[0] : 'Destination'}</Typography>}
                            secondary={`Distance Record ID [${trip.id}]: ${trip.distance || 0} miles total`}
                          />
                        </ListItem>
                      </CardActionArea>
                      {idx < history.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Box>
        )}

      </Container>

      {/* FLOATING WIDGET LAYER */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        {isChatOpen && (
          <Card sx={{ width: 380, height: 480, borderRadius: 4, boxShadow: '0 8px 32px rgba(15,23,42,0.15)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#fff' }}>
            <Box sx={{ p: 2, bgcolor: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <SmartToyIcon sx={{ color: '#38bdf8' }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>Spotter Copilot</Typography>
                  <Typography variant="caption" sx={{ color: '#38bdf8', fontSize: '10px' }}>Groq Engine RAG Active</Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={() => setIsChatOpen(false)} sx={{ color: '#94a3b8', '&:hover': { color: '#fff' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, bgcolor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {chatMessages.map((msg, index) => (
                <Box key={index} sx={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <Box sx={{ 
                    bgcolor: msg.role === 'user' ? '#2563eb' : '#e2e8f0', 
                    color: msg.role === 'user' ? '#fff' : '#0f172a',
                    p: 1.2, px: 1.6, borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 
                    fontSize: '13px', fontWeight: 500, whiteSpace: 'pre-line', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}>
                    {msg.text}
                  </Box>
                </Box>
              ))}
              {chatLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#64748b', p: 1 }}>
                  <CircularProgress size={14} color="inherit" />
                  <Typography variant="caption" sx={{ fontSize: '11px' }}>Searching contextual indices...</Typography>
                </Box>
              )}
              <div ref={chatEndRef} />
            </Box>

            <Box component="form" onSubmit={handleSendMessage} sx={{ p: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1, bgcolor: '#fff' }}>
              <TextField 
                fullWidth size="small" placeholder="Ask about shift history metrics..." 
                value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={chatLoading}
                sx={{ '& .MuiInputBase-input': { fontSize: '13px' } }}
              />
              <Button type="submit" variant="contained" disabled={chatLoading} sx={{ bgcolor: '#0f172a', minWidth: 48, p: 0, '&:hover': { bgcolor: '#1e293b' } }}>
                <SendIcon fontSize="small" />
              </Button>
            </Box>
          </Card>
        )}

        <Fab 
          color="primary" 
          onClick={() => setIsChatOpen(!isChatOpen)} 
          sx={{ 
            bgcolor: '#0f172a', 
            color: '#fff', 
            '&:hover': { bgcolor: '#1e293b' },
            boxShadow: '0 4px 12px rgba(15,23,42,0.25)' 
          }}
        >
          {isChatOpen ? <CloseIcon /> : <SmartToyIcon />}
        </Fab>
      </Box>

    </Box>
  );
}
