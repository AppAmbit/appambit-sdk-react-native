import { View, Text } from "react-native";
import CustomButton from "../components/CustomButton";
import { type NativeStackScreenProps } from "@react-navigation/native-stack";

type RootStackParamList = {
  HomeScreen: undefined;
  SecondScreen: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "SecondScreen">;

export default function SecondScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 20 }}>
        Second Screen
      </Text>

      <CustomButton
        title="Back to Analytics"
        onPress={() => navigation.navigate("HomeScreen")}
      />
    </View>
  );
}