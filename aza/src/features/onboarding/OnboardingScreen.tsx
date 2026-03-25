import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Animated,
  Dimensions,
  Image,
  TouchableOpacity,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import { useVideoPlayer, VideoView } from "expo-video";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useAppTheme, ThemeColors } from "../../theme";

const { width, height } = Dimensions.get("window");
const SLIDE_DURATION = 5000;

const slides = [
  {
    title: "INSTANT, SAFE &\nPROTECTED",
    description:
      "Transfers complete in seconds with escrow protection. Your money is safe until the recipient accepts.",
    isLight: false,
  },
  {
    title: "100% FEE-FREE\nTRANSFERS",
    description:
      "Transfers complete in seconds with escrow protection. Your money is safe until the recipient accepts.",
    isLight: false,
  },
  {
    title: "ALL IN ONE PLATFORM",
    description: "Manage your money, chat with friends, make calls and use other apps all in one place.",
    isLight: true,
  },
  {
    title: "PAY, CHAT & CALL IN\nONE APP",
    description: "",
    isLight: true,
    image: require("../../assets/v-card.png"),
  },
];
type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Onboarding"
>;
export default function OnboardingScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NavigationProp>();
  const [activeSlide, setActiveSlide] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideChangeTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const splashVideo = require("../../assets/videos/splash.mp4");

  const player = useVideoPlayer(splashVideo);

  useEffect(() => {
    if (player) {
      player.loop = true;
      player.play();
      player.allowsExternalPlayback = false;
    }
  }, [player]);

  const startAnimation = () => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: SLIDE_DURATION,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    if (isBottomSheetVisible) {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isBottomSheetVisible, bottomSheetAnim, backdropAnim]);

  useEffect(() => {
    startAnimation();

    if (slideChangeTimeout.current) {
      clearInterval(slideChangeTimeout.current);
    }

    if (activeSlide < slides.length - 1) {
      slideChangeTimeout.current = setInterval(() => {
        setActiveSlide((prev) => prev + 1);
      }, SLIDE_DURATION);
    }

    Animated.timing(fadeAnim, {
      toValue: activeSlide === slides.length - 1 ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();

    return () => {
      if (slideChangeTimeout.current) {
        clearInterval(slideChangeTimeout.current);
      }
      progressAnim.stopAnimation();
    };
  }, [activeSlide]);

  const handlePress = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    const isRight = x > width / 2;

    if (isRight) {
      if (activeSlide < slides.length - 1) {
        setActiveSlide((prev) => prev + 1);
      }
    } else {
      if (activeSlide > 0) {
        setActiveSlide((prev) => prev - 1);
      }
    }
  };

  const currentSlide = slides[activeSlide];
  if (!currentSlide) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ["#000000", "#E8EDE1"],
          }),
        },
      ]}
    >
      <StatusBar style={currentSlide.isLight ? "dark" : "light"} />

      {/* Background Video */}
      <Animated.View
        style={[
          styles.videoContainer,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          },
        ]}
      >
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
        <View style={styles.overlay} />
      </Animated.View>

      <SafeAreaView style={styles.safeArea}>
        {/* Progress Bar Container */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBarBackground,
              {
                backgroundColor: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    "rgba(255, 255, 255, 0.3)",
                    "rgba(30, 81, 40, 0.3)",
                  ],
                }),
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["#ffffff", "#1E5128"],
                  }),
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      `${(activeSlide / slides.length) * 100}%`,
                      `${((activeSlide + 1) / slides.length) * 100}%`,
                    ],
                  }),
                },
              ]}
            />
          </Animated.View>
        </View>

        <TouchableOpacity
          style={styles.contentContainer}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <Animated.Text
            style={[
              styles.title,
              {
                color: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["#ffffff", "#1E5128"],
                }),
              },
            ]}
          >
            {currentSlide.title}
          </Animated.Text>
          {!!currentSlide.description && (
            <Animated.Text
              style={[
                styles.description,
                {
                  color: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["#e5e7eb", "#3A5C45"],
                  }),
                },
              ]}
            >
              {currentSlide.description}
            </Animated.Text>
          )}
          {currentSlide.image && (
            <Animated.View
              style={[
                styles.imageContainer,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [40, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={currentSlide.image}
                style={styles.image}
                resizeMode="contain"
              />
            </Animated.View>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Button
            title="Get Started"
            onPress={() => setBottomSheetVisible(true)}
            backgroundColor="#1E5128"
            textStyle={styles.buttonText}
          />
        </View>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isBottomSheetVisible ? "auto" : "none"}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}
        >
          <TouchableOpacity
            style={styles.bottomSheetBackdrop}
            activeOpacity={1}
            onPress={() => setBottomSheetVisible(false)}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.bottomSheetContainer,
            {
              position: "absolute",
              bottom: 0,
              width: "100%",
              transform: [{ translateY: bottomSheetAnim }],
            },
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setBottomSheetVisible(false)}
            >
              <AntDesign name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.bottomSheetTitle}>Get Started</Text>
          <Text style={styles.bottomSheetDescription}>
            By continuing, you agree to our Terms & Privacy Policy.
          </Text>
          <View style={styles.bottomSheetDivider} />

          <Button
            title="Login"
            onPress={() => {
              setBottomSheetVisible(false);
              navigation.navigate("Login");
            }}
            backgroundColor="#1E5128"
            textColor="#B7ED7E"
            borderRadius={24}
          />
          <View style={{ height: 16 }} />
          <Button
            title="Create Account"
            onPress={() => navigation.navigate("SignUpNumber")}
            backgroundColor="#B7ED7E"
            textColor="#1E5128"
            borderRadius={24}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.background === "#121212";
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000",
    },
    lightContainer: {
      backgroundColor: "#E8EDE1",
    },
    videoContainer: {
      ...StyleSheet.absoluteFill,
    },
    video: {
      flex: 1,
    },
    overlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    safeArea: {
      flex: 1,
      justifyContent: "space-between",
    },
    progressContainer: {
      paddingHorizontal: 24,
      paddingTop: 16,
      zIndex: 10,
    },
    progressBarBackground: {
      width: "100%",
      height: 4,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 2,
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 40,
    },
    title: {
      fontSize: 32,
      fontWeight: "800",
      color: "#ffffff",
      lineHeight: 40,
      marginBottom: 16,
      letterSpacing: -0.5,
    },
    titleLight: {
      color: "#1E5128",
    },
    description: {
      fontSize: 15,
      fontWeight: "500",
      color: "#e5e7eb",
      lineHeight: 22,
      paddingRight: 24,
    },
    descriptionLight: {
      color: "#3A5C45",
    },
    imageContainer: {
      flex: 1,
      marginTop: 20,
      alignItems: "center",
      justifyContent: "flex-start",
    },
    image: {
      width: 400,
      height: 400,
      paddingBottom: 20,
      transform: [
        { translateX: 21 },
        { translateY: -107 },
        { rotate: "-11.78deg" },
      ],
    },
    footer: {
      paddingHorizontal: 24,
      paddingBottom: 32,
      paddingTop: 16,
    },
    button: {
      backgroundColor: "#1E5128",
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: {
      color: "#B7ED7E",
      fontSize: 16,
      fontWeight: "600",
    },
    bottomSheetOverlay: {
      ...StyleSheet.absoluteFill,
    },
    bottomSheetBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    bottomSheetContainer: {
      backgroundColor: isDark ? Colors.surface : "#ffffff",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 48,
    },
    bottomSheetHeader: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 16,
    },
    closeButton: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#F3F4F6",
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    bottomSheetTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: Colors.textPrimary,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    bottomSheetDescription: {
      fontSize: 16,
      color: Colors.textPrimary,
      lineHeight: 22,
      marginBottom: 20,
    },
    bottomSheetDivider: {
      height: 1,
      backgroundColor: Colors.border,
      marginBottom: 24,
    },
  });
}
