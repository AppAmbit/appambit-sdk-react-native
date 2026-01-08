import { Text, View, StyleSheet } from 'react-native';
import { start } from 'appambit-push-notifications';

export default function App() {

  start();

  return (
    <View style={styles.container}>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
