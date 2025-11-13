import { ScrollView, Text, Alert, View } from "react-native";
import { trackEvent, generateTestEvent, clearToken, logErrorMessage, startSession, endSession } from "appambit";
import CustomButton from "../components/CustomButton";

export default function AnalyticsScreen() {

  function tokenRefresh() {
    try {
      clearToken();

      const logTasks = [...Array(5)].map(() =>
        logErrorMessage("Sending 5 errors after an invalid token")
      );

      const eventTasks = [...Array(5)].map(() =>
        trackEvent("Sending 5 events after an invalid token", {
          "Info": "5 events sent"
        })
      );

      Promise.all(logTasks);
      clearToken();
      Promise.all(eventTasks);

      Alert.alert("Info", "Events and errors sent successfully");
    } catch (error) {
      Alert.alert("Error", "Something went wrong!");
      console.error(error);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }}>
      <View style={{ height: 30 }} />
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 20 }}>
        Analytics
      </Text>

      <CustomButton
        title="Invalidate Token"
        onPress={() => {
          clearToken()
        }}
      />

      <CustomButton
        title="Token refresh test"
        onPress={() => {
          tokenRefresh()
        }}
      />

      <CustomButton
        title="Start Session"
        onPress={() => {
          startSession()
        }}
      />

      <CustomButton
        title="End Session"
        onPress={() => {
          endSession()
        }}
      />

      <CustomButton
        title="Send 'Button Clicked' Event w/ property"
        onPress={() => {
          trackEvent("ButtonClicked", {
            "Count": "41"
          })
        }}
      />

      <CustomButton
        title="Send Default Event w/ property"
        onPress={() => {
          generateTestEvent()
        }}
      />

      <CustomButton
        title="Send Max-300-Length Event"
        onPress={() => {
          var _300Characters = "123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
          var _300Characters2 = "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678902";
          trackEvent(_300Characters, {
            _300Characters: _300Characters2,
            _300Characters2: _300Characters
          })
        }}
      />

      <CustomButton
        title="Send Send Max-20-Properties Event"
        onPress={() => {
          trackEvent("TestMaxProperties", {
            "01": "01", "02": "02", "03": "03", "04": "04", "05": "05",
            "06": "06", "07": "07", "08": "08", "09": "09", "10": "10",
            "11": "11", "12": "12", "13": "13", "14": "14", "15": "15",
            "16": "16", "17": "17", "18": "18", "19": "19", "20": "20",
            "21": "21", "22": "22", "23": "23", "24": "24", "25": "25",
          })
        }}
      />

      <CustomButton
        title="Send Batch of 220 Events"
        onPress={() => {
          Alert.alert("Info", "Turn off internet")
          for (let i = 1; i <= 220; i++) {
            trackEvent("Test Batch TrackEvent", {
              "test1": "test1" 
            });
          }
          Alert.alert("Info", "Events generated")
          Alert.alert("Info", "Turn on internet to send the events")
        }}
      />

    </ScrollView>
  );
}