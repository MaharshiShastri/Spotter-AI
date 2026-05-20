from django.urls import path
from . import views

urlpatterns = [
    path('calculate-trip/', views.calculate_trip_api, name="calculate_trip_api"),
    path('trip-history/', views.get_trip_history, name="get_trip_history"),
    path("manual-log/", views.log_manual_status, name="log_manual_status"),
    path('chat/', views.groq_rag_chat, name='groq_rag_chat'),
    path('delete-trip/<int:trip_id>/', views.delete_trip_api, name='delete_trip_api'),
]
