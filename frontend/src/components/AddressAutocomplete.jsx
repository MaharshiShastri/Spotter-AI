import React, { useEffect, useState } from 'react';
import { TextField, Autocomplete, CircularProgress } from '@mui/material';

export default function AddressAutocomplete({ label, value, onChange, name }) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        if (!inputValue || typeof inputValue !== 'string' || inputValue.length < 3) {
            setOptions([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputValue)}&countrycodes=us,ca,mx&limit=5`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        const mappedOptions = data.map((item) => item.display_name || '');
                        setOptions(mappedOptions);
                    }
                }
            } catch (error) {
                console.error("OSM Geocoding fetch issue:", error);
            } finally {
                setLoading(false);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [inputValue]);

    return (
        <Autocomplete 
            open={open} 
            onOpen={() => setOpen(true)} 
            onClose={() => setOpen(false)} 
            options={options} 
            loading={loading} 
            value={value || null}
            freeSolo
            getOptionLabel={(option) => (typeof option === 'string' ? option : '')}
            onChange={(event, newValue) => {
                const cleanValue = typeof newValue === 'string' ? newValue : '';
                onChange({ target: { name, value: cleanValue } });
            }}
            inputValue={inputValue}
            onInputChange={(event, newInputValue, reason) => {
                if (reason === 'clear' || !newInputValue) {
                    setInputValue('');
                    onChange({ target: { name, value: '' } });
                } else if (typeof newInputValue === 'string') {
                    setInputValue(newInputValue);
                    onChange({ target: { name, value: newInputValue } });
                }
            }}
            renderInput={(params) => (
                <TextField 
                    {...params} 
                    label={label} 
                    fullWidth 
                    sx={{ mb: 2.5 }} 
                    /* CRITICAL FIX: Use InputProps directly rather than slotProps.input 
                      to safeguard the internal MUI autocomplete linking hooks and refs.
                    */
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <React.Fragment>
                                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps?.endAdornment}
                            </React.Fragment>
                        ),
                    }}
                />
            )}
        />
    );
}
