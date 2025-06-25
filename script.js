// Firebase imports for Canvas environment boilerplate
// These imports are necessary for the Canvas environment to function correctly,
// even if Firestore is not actively used for this specific application's data.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment.
// These are crucial for Firebase initialization within Canvas.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 

// Firebase Initialization:
// Initialize Firebase app, Firestore, and Auth.
// The weather app itself doesn't use Firestore for data persistence,
// but this boilerplate is required for the Canvas environment.
let app, db, auth;
if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Authenticate the user (anonymously or with a custom token).
    // This ensures the app is properly set up within the Canvas environment.
    window.onload = async () => {
        try {
            if (initialAuthToken) {
                // Attempt to sign in with a provided custom token.
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Firebase: Signed in with custom token.");
            } else {
                // If no custom token, sign in anonymously.
                await signInAnonymously(auth);
                console.log("Firebase: Signed in anonymously.");
            }
            // Get the user ID; this could be used for personalized features if needed in a more complex app.
            const userId = auth.currentUser?.uid || crypto.randomUUID();
            console.log("Firebase User ID:", userId);
        } catch (error) {
            // Log and display any Firebase authentication errors.
            console.error("Firebase Auth Error:", error);
            showMessageBox("Firebase authentication error: " + error.message);
        }
        // After Firebase is initialized and authenticated, set up the weather app's event listeners.
        setupEventListeners();
    };
} else {
    // If Firebase configuration is missing, log a warning and proceed without Firebase features.
    console.warn("Firebase config not found. Firebase features will be disabled.");
    // Still set up the weather app's event listeners when the window loads.
    window.onload = setupEventListeners;
}

// --- Weather App Logic ---
// Replace 'YOUR_WEATHERAPI_KEY' with your actual API key from weatherapi.com
const WEATHER_API_KEY = 'b4851918bda340c4b4911927252506'; 

// Get references to DOM elements
const cityInput = document.getElementById('city-input');
const searchButton = document.getElementById('search-button');
const currentWeatherSection = document.getElementById('current-weather');
const forecastSection = document.getElementById('forecast-section');
const forecastCardsContainer = document.getElementById('forecast-cards');
const loader = document.getElementById('loader');
const messageBox = document.getElementById('message-box');
const suggestionsList = document.getElementById('suggestions-list');

let debounceTimer; // Variable to hold the debounce timer for input suggestions

/**
 * Displays a temporary message box at the top of the screen.
 * @param {string} message - The message to display.
 * @param {number} duration - How long the message should be visible in milliseconds (default: 3000ms).
 */
function showMessageBox(message, duration = 3000) {
    messageBox.textContent = message;
    messageBox.classList.add('show'); // Add 'show' class to make it visible
    setTimeout(() => {
        messageBox.classList.remove('show'); // Remove 'show' class to hide it after duration
    }, duration);
}

/**
 * Shows the loading spinner and disables input/button.
 */
function showLoader() {
    loader.classList.add('show');
    searchButton.disabled = true; // Disable button to prevent multiple clicks
    cityInput.disabled = true; // Disable input during loading
}

/**
 * Hides the loading spinner and re-enables input/button.
 */
function hideLoader() {
    loader.classList.remove('show');
    searchButton.disabled = false; // Re-enable button
    cityInput.disabled = false; // Re-enable input
}

/**
 * Fetches current weather and 5-day forecast data from WeatherAPI.com.
 * Handles API calls, error checking, and updates the UI.
 * @param {string} city - The name of the city to get weather for.
 */
async function getWeather(city) {
    // Check if API key is provided
    if (!WEATHER_API_KEY || WEATHER_API_KEY === 'YOUR_WEATHERAPI_KEY') {
        showMessageBox("Please replace 'YOUR_WEATHERAPI_KEY' with your WeatherAPI.com API key.");
        return;
    }

    showLoader(); // Show loader before fetching data
    suggestionsList.classList.add('hidden'); // Hide suggestions when a search is initiated

    try {
        // Construct the API URL for forecast, including current weather and 5 days.
        // 'lang=en' requests data in English.
        const apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${city}&days=5&lang=en`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        // Check for API-specific errors (e.g., city not found)
        if (data.error) {
            showMessageBox(`Error: ${data.error.message}`);
            // Hide weather sections if an error occurs
            currentWeatherSection.classList.add('hidden');
            forecastSection.classList.add('hidden');
            hideLoader();
            return;
        }
        // Check for general HTTP errors (e.g., 404, 500)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}, message: ${data.error ? data.error.message : 'Unknown error'}`);
        }

        // Display the fetched weather data
        displayCurrentWeather(data);
        displayForecast(data);

        // Show weather sections after successful data retrieval
        currentWeatherSection.classList.remove('hidden');
        forecastSection.classList.remove('hidden');

    } catch (error) {
        // Catch any network or parsing errors
        console.error('Error fetching weather data:', error);
        showMessageBox('Could not retrieve weather data. Please try again later.');
        // Ensure sections are hidden on error
        currentWeatherSection.classList.add('hidden');
        forecastSection.classList.add('hidden');
    } finally {
        hideLoader(); // Always hide loader after request completes (success or failure)
    }
}

/**
 * Populates the current weather section of the UI with data.
 * @param {Object} data - The full weather data object from WeatherAPI.com.
 */
function displayCurrentWeather(data) {
    const current = data.current;
    const location = data.location;

    // Update city name and country
    document.getElementById('city-name').textContent = `${location.name}, ${location.country}`;
    
    // Format and display current date
    const date = new Date(location.localtime_epoch * 1000); // Convert Unix timestamp to Date
    document.getElementById('current-date').textContent = date.toLocaleDateString('en-US', { // Changed locale to 'en-US'
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Update temperature, description, and "feels like"
    document.getElementById('temperature').textContent = `${Math.round(current.temp_c)}°C`;
    document.getElementById('description').textContent = current.condition.text;
    document.getElementById('feels-like').textContent = `Feels like: ${Math.round(current.feelslike_c)}°C`; // Translated
    
    // Update detailed parameters
    document.getElementById('humidity').textContent = `${current.humidity}%`;
    document.getElementById('wind-speed').textContent = `${current.wind_kph.toFixed(1)} km/h`;
    document.getElementById('pressure').textContent = `${current.pressure_mb} hPa`; // pressure_mb is in hPa

    // Update weather icon
    document.getElementById('weather-icon').src = `https:${current.condition.icon}`;
    document.getElementById('weather-icon').alt = current.condition.text;
}

/**
 * Populates the 5-day forecast section of the UI with data.
 * Creates individual cards for each forecast day.
 * @param {Object} data - The full weather data object from WeatherAPI.com.
 */
function displayForecast(data) {
    forecastCardsContainer.innerHTML = ''; // Clear any existing forecast cards

    // Iterate over each day in the forecast
    data.forecast.forecastday.forEach(dayData => {
        const date = new Date(dayData.date_epoch * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }); // E.g., "Mon", "Tue"

        // Create a new div element for the forecast card
        const card = document.createElement('div');
        card.className = 'forecast-card bg-white p-4 rounded-xl shadow-md text-center flex flex-col items-center justify-between transition-transform transform hover:scale-105';
        
        // Populate the card's inner HTML with daily weather details
        card.innerHTML = `
            <p class="text-gray-700 font-semibold mb-2">${dayName}</p>
            <img src="https:${dayData.day.condition.icon}" alt="${dayData.day.condition.text}" class="w-16 h-16 object-contain mb-2">
            <p class="text-gray-800 text-lg font-bold">${Math.round(dayData.day.maxtemp_c)}°C / ${Math.round(dayData.day.mintemp_c)}°C</p>
            <p class="text-gray-600 text-sm capitalize">${dayData.day.condition.text}</p>
        `;
        forecastCardsContainer.appendChild(card); // Add the card to the container
    });
}

/**
 * Fetches city suggestions from WeatherAPI.com Search/Autocomplete API.
 * Only fetches if the query is at least 3 characters long.
 * @param {string} query - The search query for city suggestions.
 */
async function getCitySuggestions(query) {
    // Only fetch suggestions if the query has at least 3 characters
    if (query.length < 3) {
        suggestionsList.innerHTML = ''; // Clear existing suggestions
        suggestionsList.classList.add('hidden'); // Hide the suggestions list
        return;
    }

    try {
        // Construct API URL for city search/autocomplete
        const apiUrl = `https://api.weatherapi.com/v1/search.json?key=${WEATHER_API_KEY}&q=${query}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        displaySuggestions(data); // Display the fetched suggestions
    } catch (error) {
        console.error('Error fetching city suggestions:', error);
        suggestionsList.innerHTML = ''; // Clear and hide on error
        suggestionsList.classList.add('hidden');
    }
}

/**
 * Displays city suggestions in the UI as clickable items.
 * @param {Array} suggestions - An array of city suggestion objects from the API.
 */
function displaySuggestions(suggestions) {
    suggestionsList.innerHTML = ''; // Clear previous suggestions
    if (suggestions && suggestions.length > 0) {
        // Create a div for each suggestion
        suggestions.forEach(item => {
            // Combine name, region, and country for a comprehensive suggestion string
            const suggestionText = `${item.name}, ${item.region ? item.region + ', ' : ''}${item.country}`;
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'suggestion-item';
            suggestionDiv.textContent = suggestionText;
            
            // Add click listener to fill input and fetch weather when a suggestion is clicked
            suggestionDiv.addEventListener('click', () => {
                cityInput.value = item.name; // Set input value to the selected city's name
                suggestionsList.classList.add('hidden'); // Hide the suggestions list
                getWeather(item.name); // Fetch weather for the selected city
            });
            suggestionsList.appendChild(suggestionDiv); // Add suggestion to the list
        });
        suggestionsList.classList.remove('hidden'); // Show the suggestions list
    } else {
        suggestionsList.classList.add('hidden'); // Hide if no suggestions are found
    }
}

/**
 * Sets up all event listeners for the weather application's interactive elements.
 */
function setupEventListeners() {
    // Event listener for the search button click
    searchButton.addEventListener('click', () => {
        const city = cityInput.value.trim(); // Get trimmed city name from input
        if (city) {
            getWeather(city); // Fetch weather if city name is not empty
        } else {
            showMessageBox("Please enter a city name."); // Prompt user if input is empty
        }
    });

    // Event listener for 'Enter' key press in the city input field
    cityInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            searchButton.click(); // Simulate a click on the search button
        }
    });

    // Debounced input event listener for city suggestions
    // This prevents too many API calls while the user is typing
    cityInput.addEventListener('input', (event) => {
        clearTimeout(debounceTimer); // Clear any previous debounce timer
        const query = event.target.value.trim(); // Get trimmed input value
        debounceTimer = setTimeout(() => {
            getCitySuggestions(query); // Call suggestion function after a delay
        }, 300); // 300ms debounce time
    });

    // Event listener to hide suggestions when clicking outside the input or suggestions list
    document.addEventListener('click', (event) => {
        // Check if the click target is outside both the city input and the suggestions list
        if (!cityInput.contains(event.target) && !suggestionsList.contains(event.target)) {
            suggestionsList.classList.add('hidden'); // Hide suggestions
        }
    });

    // Optionally, fetch weather for a default city ('Ho Chi Minh City') on initial load
    getWeather('Ho Chi Minh City');
}
