import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";

interface AILogoIconProps {
  size?: number;
  color?: string;
}

export default function AILogoIcon({ size = 22, color = "#4dff91" }: AILogoIconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="flash" size={size} color={color} />
    </View>
  );
}
