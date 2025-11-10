import { Pressable, Text, StyleSheet, type GestureResponderEvent } from "react-native";

interface Props {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
}

export default function CustomButton({ title, onPress }: Props) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "90%",
    height: 45,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 6,
    borderRadius: 8,
  },
  text: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});