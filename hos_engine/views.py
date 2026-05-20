# hos_engine/views.py
import os
import json
import urllib.parse
import requests
from django.db import models
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from groq import Groq
from .models import Trip, ManualDriverLog

def geocode_osm(address_string):
    if not address_string:
        return None
    if "GPS:" in address_string:
        try:
            coords = address_string.replace("GPS:", "").strip().split(",")
            return float(coords[0]), float(coords[1])
        except Exception:
            pass

    api_key = os.environ.get("MAPS_CO_API_KEY")
    if not api_key:
        print("Warning: MAPS_CO_API_KEY missing from environment variables.")
        return None

    try:
        url = f"https://geocode.maps.co/search?q={urllib.parse.quote(address_string)}&api_key={api_key}"
        headers = {'User-Agent': 'SpotterAI_Engine/2.0'}
        response = requests.get(url, headers=headers, timeout=45)
        if response.ok and response.json():
            payload = response.json()[0]
            return float(payload['lat']), float(payload['lon'])
    except Exception as e:
        print(f"Maps.co Geocoding Exception: {str(e)}")
    return None

def calculate_osrm_distance(origin_coords, dest_coords):
    if not origin_coords or not dest_coords:
        return 0.0
    try:
        url = f"http://router.project-osrm.org/route/v1/driving/{origin_coords[1]},{origin_coords[0]};{dest_coords[1]},{dest_coords[0]}?overview=false"
        response = requests.get(url, timeout=45)
        if response.ok:
            payload = response.json()
            if "routes" in payload and len(payload["routes"]) > 0:
                meters_distance = payload["routes"][0]["distance"]
                return round(meters_distance * 0.000621371, 1)
    except Exception as e:
        print(f"OSRM Infrastructure Routing Network exception: {str(e)}")
    return 0.0

@api_view(['POST'])
def calculate_trip_api(request):
    """
    Primary API endpoint to calculate an FMCSA-compliant driving itinerary schedule.
    Accepts an explicit user 'start_time' parameter directly from the driver payload interface.
    """
    data = request.data
    current_loc = data.get('current_location', '')
    pickup_loc = data.get('pickup_location', '')
    dropoff_loc = data.get('dropoff_location', '')
    cycle_used_raw = data.get('cycle_used', '0')
    
    # NEW: Read explicit driver-selected start time parameter (Default fallback: 06:00)
    driver_start_time = data.get('start_time', '06:00')
    try:
        base_start = int(driver_start_time.split(':')[0])
    except Exception:
        base_start = 6
    
    try:
        cycle_used = float(cycle_used_raw) if cycle_used_raw else 0.0
    except ValueError:
        cycle_used = 0.0
    
    current_point = geocode_osm(current_loc)
    pickup_point = geocode_osm(pickup_loc)
    dropoff_point = geocode_osm(dropoff_loc)
    
    leg_one_miles = calculate_osrm_distance(current_point, pickup_point)
    leg_two_miles = calculate_osrm_distance(pickup_point, dropoff_point)
    computed_total_miles = round(leg_one_miles + leg_two_miles, 1)
    
    if computed_total_miles <= 0:
        computed_total_miles = 450.0

    estimated_hours = round(computed_total_miles / 55.0, 1)
    remaining_driving_hours = estimated_hours
    
    logs_by_day = {}
    day_counter = 1
    
    while remaining_driving_hours > 0:
        day_key = f"Day {day_counter}"
        day_driving_this_shift = min(remaining_driving_hours, 11.0)
        remaining_driving_hours = round(remaining_driving_hours - day_driving_this_shift, 1)
        
        start_str = f"{base_start:02d}:00"
        driving_start_str = f"{(base_start + 1):02d}:00"
        
        # 1. NEW: Calculate initial morning rest buffer from midnight to driver start time
        initial_rest_mins = base_start * 60
        day_initial_segments = []
        
        if initial_rest_mins > 0:
            day_initial_segments.append({
                "status": "OFF_DUTY", 
                "start": "00:00", 
                "duration_mins": initial_rest_mins, 
                "remark": "Initial Off-Duty Rest Period"
            })

        # 2. Append the calculated workload legs for the day
        if day_driving_this_shift >= 11.0:
            route_segments = [
                {"status": "ON_DUTY", "start": start_str, "duration_mins": 60, "remark": f"Pre-Trip Inspection for route to {dropoff_loc[:15]}"},
                {"status": "DRIVING", "start": driving_start_str, "duration_mins": 300, "remark": "Transit Leg Part 1"},
                {"status": "OFF_DUTY", "start": f"{(base_start+6)%24:02d}:00", "duration_mins": 30, "remark": "Mandatory 30-Min Rest Break"},
                {"status": "DRIVING", "start": f"{(base_start+6)%24:02d}:30", "duration_mins": 360, "remark": "Transit Leg Part 2"},
                {"status": "ON_DUTY", "start": f"{(base_start+12)%24:02d}:30", "duration_mins": 30, "remark": "Post-Trip Inspection & Site Parking"},
                {"status": "SLEEPER_BERTH", "start": f"{(base_start+13)%24:02d}:00", "duration_mins": 600, "remark": "Mandatory 10-Hour Sleep Cycle"}
            ]
        else:
            driving_mins = int(day_driving_this_shift * 60)
            drv_start_mins = (base_start + 1) * 60
            post_start_mins = drv_start_mins + driving_mins
            slp_start_mins = post_start_mins + 60
            
            route_segments = [
                {"status": "ON_DUTY", "start": start_str, "duration_mins": 60, "remark": "Pre-Trip Fleet Verification"},
                {"status": "DRIVING", "start": driving_start_str, "duration_mins": driving_mins, "remark": "Final Approach to Delivery Destination Hub"},
                {"status": "ON_DUTY", "start": f"{(post_start_mins // 60) % 24:02d}:{post_start_mins % 60:02d}", "duration_mins": 60, "remark": "Unloading & Post-Trip Checkout Complete"},
                {"status": "SLEEPER_BERTH", "start": f"{(slp_start_mins // 60) % 24:02d}:{slp_start_mins % 60:02d}", "duration_mins": 600, "remark": "Rest Cycle"}
            ]
            
        # Combine the midnight anchor block with the rest of the operational segments
        logs_by_day[day_key] = day_initial_segments + route_segments
        day_counter += 1

    waypoints = [
        {"name": current_loc if current_loc else "Current Position", "lat": current_point[0] if current_point else 39.0997, "lng": current_point[1] if current_point else -94.5786},
        {"name": pickup_loc if pickup_loc else "Pickup Hub", "lat": pickup_point[0] if pickup_point else 41.8781, "lng": pickup_point[1] if pickup_point else -87.6298},
        {"name": dropoff_loc if dropoff_loc else "Delivery Destination", "lat": dropoff_point[0] if dropoff_point else 25.7617, "lng": dropoff_point[1] if dropoff_point else -80.1918}
    ]
        
    db_trip = Trip.objects.create(
        current_location=current_loc or "Unknown Origin",
        pickup_location=pickup_loc or "Unknown Pickup Hub",
        dropoff_location=dropoff_loc or "Unknown Destination",
        distance_miles=computed_total_miles,
        cycle_used=cycle_used,
        is_completed=False,
        timeline_data=logs_by_day,
        waypoints_data=waypoints
    )

    return Response({
        "trip_id": db_trip.id,
        "distance_miles": computed_total_miles,
        "estimated_driving_time_hours": estimated_hours,
        "logs_by_day": logs_by_day,
        "waypoints": waypoints
    })

@api_view(['POST'])
def log_manual_status(request):
    """
    Accepts a real manual change request from the driver workspace.
    Processes dynamic custom 'start' and 'duration_mins' parameters from the front end.
    """
    status_type = request.data.get('status', 'OFF_DUTY')
    remark = request.data.get('remark', '')
    trip_id = request.data.get('trip_id')
    
    # NEW: Extract real operational metrics passed from front-end client components
    custom_start = request.data.get('start', '12:00')
    custom_duration = int(request.data.get('duration_mins', 30))
    
    ManualDriverLog.objects.create(status=status_type, remark=remark)
    
    if trip_id:
        try:
            trip = Trip.objects.get(id=trip_id)
            if status_type == "END_TRIP":
                trip.is_completed = True
            else:
                current_timeline = dict(trip.timeline_data)
                days = list(current_timeline.keys())
                target_day = days[-1] if days else "Day 1"
                
                if target_day not in current_timeline:
                    current_timeline[target_day] = []
                
                # FIX: Injected properties now pull explicitly from variables instead of sandboxed defaults
                current_timeline[target_day].append({
                    "status": status_type,
                    "start": custom_start,
                    "duration_mins": custom_duration,
                    "remark": f"[In-Cab Update] {remark}"
                })
                
                # Keeps the graph rendering sequence continuous
                current_timeline[target_day] = sorted(
                    current_timeline[target_day], 
                    key=lambda x: [int(num) for num in x['start'].split(':')]
                )
                
                trip.timeline_data = current_timeline
            trip.save()
        except Trip.DoesNotExist:
            pass

    return Response({"status": status_type, "time": f"{custom_start}:00", "remark": remark})

@api_view(['GET'])
def get_trip_history(request):
    trips = Trip.objects.all().order_by('-created_at')
    history_payload = []
    for t in trips:
        history_payload.append({
            "id": t.id,
            "origin": t.current_location,
            "pickup": t.pickup_location,
            "dropoff": t.dropoff_location,
            "distance": t.distance_miles,
            "is_completed": t.is_completed,
            "date": t.created_at.strftime('%Y-%m-%d'),
            "waypoints": t.waypoints_data,
            "logs_by_day": t.timeline_data
        })
    return Response(history_payload)

@api_view(['DELETE'])
def delete_trip_api(request, trip_id):
    try:
        trip = Trip.objects.get(id=trip_id)
        trip.delete()
        return Response({"success": True, "message": f"Trip {trip_id} purged successfully."}, status=status.HTTP_200_OK)
    except Trip.DoesNotExist:
        return Response({"success": False, "message": "Trip log record not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
def groq_rag_chat(request):
    user_message = request.data.get('message', '')
    db_trips = Trip.objects.all().order_by('-created_at')[:10]
    db_context_string = "Driver's historical dispatches logged inside the local SQLite database:\n"
    
    if not db_trips.exists():
        db_context_string += "- No previous trip records are archived within the active system.\n"
    else:
        for index, trip in enumerate(db_trips, start=1):
            db_context_string += (
                f"Itinerary #{index} (ID: {trip.id}): Route from {trip.pickup_location} to {trip.dropoff_location}. "
                f"Total Distance: {trip.distance_miles} miles. Status State: {'Closed/Archived' if trip.is_completed else 'Active/Open'}.\n"
            )
            days_data = trip.timeline_data or {}
            total_sleep_mins = 0
            for day, segments in days_data.items():
                for seg in segments:
                    if seg.get('status') == 'SLEEPER_BERTH':
                        total_sleep_mins += seg.get('duration_mins', 0)
            db_context_string += f"   -> Logged Sleep Record for this Itinerary: {round(total_sleep_mins / 60, 1)} hours spent in SLEEPER_BERTH.\n"

    client = Groq(api_key=os.environ.get("GROQ_API_KEY", "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"))
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": f"You are Spotter AI's advanced Fleet Analytics HOS copilot. Answer user questions based on this database ledger context:\n\n{db_context_string}"},
                {"role": "user", "content": user_message}
            ],
            temperature=0.2,
            max_tokens=450
        )
        return Response({"reply": completion.choices[0].message.content})
    except Exception as e:
        return Response({"reply": f"Groq contextual error: {str(e)}"}, status=500)
    finally:
        try: client.close()
        except: pass
