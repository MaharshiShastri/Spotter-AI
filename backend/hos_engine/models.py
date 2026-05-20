from django.db import models

# Create your models here.
class Trip(models.Model):
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    distance_miles = models.FloatField()
    cycle_used =models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    is_completed = models.BooleanField(default=False)
    timeline_data = models.JSONField()
    waypoints_data = models.JSONField()

    def __str__(self):
        return f"Trip {self.id}: {self.pickup_location} -> {self.dropoff_location}"
    
class ManualDriverLog(models.Model):
    STATUS_CHOICES = [
        ("OFF_DUTY", "Off Duty"),
        ("SLEEPER_BERTH", "Sleeper Berth"),
        ("DRIVING", "Driving"),
        ("ON_DUTY", "On duty(Not driving)"),
        ("END_TRIP", "End of Trip/Post-trip"),
    ]

    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    remark = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.timestamp.strftime('%H:%M')} - {self.status}: {self.remark}"
