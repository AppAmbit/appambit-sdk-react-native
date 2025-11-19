import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import CustomButton from './CustomButton';

interface CustomInputProps {
  placeholder: string;
  buttonLabel: string;
  defaultValue: string;
  onSubmit: (value: string) => void;
}

const CustomInput: React.FC<CustomInputProps> = ({ placeholder, buttonLabel, defaultValue, onSubmit }) => {
  const [value, setValue] = useState(defaultValue);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        placeholder={placeholder}
        onChangeText={setValue}
      />
      <CustomButton title={buttonLabel} onPress={() => onSubmit(value)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: "100%",
    alignItems: "center"
  },
  input: {
    width: "90%",
    height: "50",
    borderWidth: 1,
    borderColor: '#999',
    padding: 10,
    marginBottom: 8,
    borderRadius: 4,
  },
});

export default CustomInput;