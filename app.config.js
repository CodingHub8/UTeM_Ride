module.exports = {
  expo: {
    name: "UTeM_Ride",
    slug: "UTeM_Ride",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
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
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
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
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
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
