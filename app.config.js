module.exports = {
  expo: {
    name: "UTeM Ride",
    slug: "UTeM_Ride",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/UTeMRideIcon.png",
    scheme: "utemride",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    updates: {
      enabled: false,
      checkOnLaunch: "NEVER"
    },
    ios: {
      supportsTablet: true,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    android: {
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/images/UTeMRideIcon.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.manbil.UTeM_Ride",
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "FOREGROUND_SERVICE"]
    },
    web: {
      output: "static",
      favicon: "./assets/images/UTeMRideIcon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/UTeMRideIconWhiteTextTransparent.png",
          "imageWidth": 250,
          "resizeMode": "contain",
          "backgroundColor": "#0057B8",
          "dark": {
            "backgroundColor": "#0057B8"
          }
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/images/UTeMRideIcon.png",
          "color": "#0057B8"
        }
      ]
    ],
    experiments: {
      "typedRoutes": true,
      "reactCompiler": true
    },
    extra: {
      router: {},
      eas: {
        projectId: "b4bce41e-c6c8-4e65-a282-c618fe1f21ba"
      }
    }
  }
};
