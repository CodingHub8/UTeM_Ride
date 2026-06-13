import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_PLACES_KEY = 'recent_destinations';

export async function getCurrentLocationAddress() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Try Google Maps Geocoding API first
    if (apiKey) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.coords.latitude},${location.coords.longitude}&key=${apiKey}`
        );
        const data = await response.json();
        if (data.status === 'OK' && data.results.length > 0) {
          return {
            address: data.results[0].formatted_address,
            coords: location.coords
          };
        }
      } catch (e) {
        console.warn('Google Geocoding failed, falling back to native:', e);
      }
    }

    // Fallback to Expo Native Geocoder
    const results = await Location.reverseGeocodeAsync(location.coords);
    if (results && results.length > 0) {
      const place = results[0];
      const address = [place.name, place.street, place.district, place.city]
        .filter(Boolean)
        .join(', ');
      return {
        address: address || 'Unknown Location',
        coords: location.coords
      };
    }
    
    return {
      address: 'Unknown Location',
      coords: location.coords
    };
  } catch (error) {
    console.error('Error getting location address:', error);
    return null;
  }
}

export async function getDirections(origin: string | { lat: number, lng: number }, destination: string | { lat: number, lng: number }) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('API Key missing for Directions API');
    return null;
  }

  const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
  const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&key=${apiKey}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      return {
        distance: leg.distance.text,
        distanceValue: leg.distance.value, // in meters
        duration: leg.duration.text,
        durationValue: leg.duration.value, // in seconds
        polyline: decodePolyline(route.overview_polyline.points),
        startCoords: leg.start_location,
        endCoords: leg.end_location,
      };
    } else {
      console.warn('Directions API Error:', data.status, data.error_message || 'No error message');
      return null;
    }
  } catch (error) {
    console.error('Error fetching directions:', error);
    return null;
  }
}

export async function saveRecentDestination(destination: { name: string, address: string, lat?: number, lng?: number, icon?: any }) {
  try {
    const stored = await AsyncStorage.getItem(RECENT_PLACES_KEY);
    let places = stored ? JSON.parse(stored) : [];
    
    // Filter out if already exists
    places = places.filter((p: any) => p.name !== destination.name);
    
    // Add to front
    places.unshift({
      id: Date.now().toString(),
      ...destination,
      icon: destination.icon || 'location'
    });
    
    // Limit to 8
    places = places.slice(0, 8);
    
    await AsyncStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(places));
  } catch (e) {
    console.error('Error saving recent destination:', e);
  }
}

export async function getRecentDestinations() {
  try {
    const stored = await AsyncStorage.getItem(RECENT_PLACES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error getting recent destinations:', e);
    return [];
  }
}

export async function getNearbyPlaces(lat: number, lng: number) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=point_of_interest&key=${apiKey}`
    );
    const data = await response.json();
    if (data.status === 'OK') {
      return data.results.slice(0, 5).map((p: any) => ({
        id: p.place_id,
        name: p.name,
        address: p.vicinity,
        coords: {
          latitude: p.geometry.location.lat,
          longitude: p.geometry.location.lng
        }
      }));
    }
    return [];
  } catch (e) {
    console.error('Error fetching nearby places:', e);
    return [];
  }
}

export async function getPlaceAutocomplete(input: string, lat?: number, lng?: number) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !input) return [];

  const locationBias = lat && lng ? `&location=${lat},${lng}&radius=10000` : '';

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}${locationBias}&key=${apiKey}`
    );
    const data = await response.json();
    if (data.status === 'OK') {
      return data.predictions.map((p: any) => ({
        id: p.place_id,
        name: p.structured_formatting.main_text,
        address: p.structured_formatting.secondary_text || p.description,
        isAutocomplete: true
      }));
    }
    return [];
  } catch (e) {
    console.error('Error fetching autocomplete:', e);
    return [];
  }
}

export async function getPlaceDetails(placeId: string) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !placeId) return null;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${apiKey}`
    );
    const data = await response.json();
    if (data.status === 'OK') {
      return {
        latitude: data.result.geometry.location.lat,
        longitude: data.result.geometry.location.lng
      };
    }
    return null;
  } catch (e) {
    console.error('Error fetching place details:', e);
    return null;
  }
}

// Helper to decode Google Maps encoded polyline
function decodePolyline(encoded: string) {
  const points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

const RECENT_PICKUPS_KEY = 'recent_pickups';

export async function saveRecentPickup(pickup: { name: string, address: string, lat?: number, lng?: number, icon?: any }) {
  try {
    const stored = await AsyncStorage.getItem(RECENT_PICKUPS_KEY);
    let places = stored ? JSON.parse(stored) : [];
    
    places = places.filter((p: any) => p.name !== pickup.name);
    
    places.unshift({
      id: Date.now().toString(),
      ...pickup,
      icon: pickup.icon || 'location'
    });
    
    places = places.slice(0, 8);
    await AsyncStorage.setItem(RECENT_PICKUPS_KEY, JSON.stringify(places));
  } catch (e) {
    console.error('Error saving recent pickup:', e);
  }
}

export async function getRecentPickups() {
  try {
    const stored = await AsyncStorage.getItem(RECENT_PICKUPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error getting recent pickups:', e);
    return [];
  }
}
