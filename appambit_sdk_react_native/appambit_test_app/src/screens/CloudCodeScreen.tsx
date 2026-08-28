import { useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import CustomButton from "../components/CustomButton";
import { cloudCodeDemos, sectionNames, type CloudCodeDemo, type CloudCodeSection } from "../cloudcode/CloudCodeCatalog";
import { useCloudCodeRunner } from "../cloudcode/useCloudCodeRunner";

// Layout mirrors CloudCode.kt (Android sample) / CloudCodeView.swift (iOS sample):
// a "Setup Database" card and a CMS status card at the top, then one block per
// section (Database, CMS, Push, HTTP) with its own input fields followed by that
// section's demo cards, each showing its own result inline once it has run.

function ResultCard({
  visible,
  title,
  text,
  expanded,
  onToggle,
}: {
  visible: boolean;
  title: string;
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!visible) return null;
  return (
    <Pressable style={styles.resultBox} onPress={onToggle}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{title}</Text>
        <Text style={styles.resultToggle}>{expanded ? "Collapse" : "Expand"}</Text>
      </View>
      {expanded && <Text style={styles.resultText}>{text}</Text>}
    </Pressable>
  );
}

function DemoRow({
  demo,
  disabled,
  onRun,
}: {
  demo: CloudCodeDemo;
  disabled: boolean;
  onRun: (demo: CloudCodeDemo) => void;
}) {
  return (
    <View style={styles.demoRow}>
      <Text style={styles.demoSlug}>{demo.slug}</Text>
      <Text style={styles.demoDetail}>{demo.detail}</Text>
      <Text style={styles.demoPrerequisite}>{demo.prerequisite}</Text>
      <CustomButton title="Run" onPress={() => !disabled && onRun(demo)} />
    </View>
  );
}

export default function CloudCodeScreen() {
  const runner = useCloudCodeRunner();

  const handleRun = (demo: CloudCodeDemo) => {
    if (runner.isRunning) return;
    runner.runOrConfirm(demo);
  };

  const pendingId = runner.pendingConfirmation?.id ?? null;
  useEffect(() => {
    if (!pendingId) return;
    Alert.alert(
      "Confirm Cloud Code action",
      "This calls a real backend operation. Continue only if the required service is configured.",
      [
        { text: "Cancel", style: "cancel", onPress: runner.cancelPending },
        { text: "Run", onPress: runner.confirmPending },
      ],
      { cancelable: true, onDismiss: runner.cancelPending }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId]);

  const renderSectionInputs = (section: CloudCodeSection) => {
    if (section === "Database") {
      return (
        <View style={styles.inputs}>
          <TextInput
            style={styles.input}
            value={runner.form.taskTitle}
            onChangeText={runner.setTaskTitle}
            placeholder="Task title"
          />
          <TextInput
            style={styles.input}
            value={runner.form.taskId}
            onChangeText={runner.setTaskId}
            placeholder="Task id for update/delete"
            keyboardType="number-pad"
          />
        </View>
      );
    }
    if (section === "CMS") {
      return (
        <View style={styles.inputs}>
          <TextInput
            style={styles.input}
            value={runner.form.postUuid}
            onChangeText={runner.setPostUuid}
            placeholder="CMS post UUID (optional)"
          />
          <TextInput
            style={styles.input}
            value={runner.form.publishTitle}
            onChangeText={runner.setPublishTitle}
            placeholder="Sample title"
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={runner.form.publishBody}
            onChangeText={runner.setPublishBody}
            placeholder="Sample body"
            multiline
            numberOfLines={3}
          />
        </View>
      );
    }
    return null;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cloud Code</Text>
      <Text style={styles.subtitle}>HTTP-triggered functions using the React Native consumer token.</Text>

      <View style={styles.setupCard}>
        <Text style={styles.setupCardTitle}>Database</Text>
        <Text style={[styles.badge, styles.badgeDatabase]}>Create Database first</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{runner.databaseStatus}</Text>
          {runner.isVerifyingBackend && <ActivityIndicator size="small" />}
        </View>
        <DemoRow
          demo={runner.setupDatabaseDemo}
          disabled={!runner.canRunSetupDatabase}
          onRun={handleRun}
        />
        <ResultCard
          visible={runner.lastResultDemoId === runner.setupDatabaseDemo.id}
          title={runner.resultTitle}
          text={runner.resultText}
          expanded={runner.isResultExpanded}
          onToggle={() => runner.setIsResultExpanded(!runner.isResultExpanded)}
        />
      </View>

      <View style={styles.setupCard}>
        <Text style={styles.setupCardTitle}>CMS</Text>
        <Text style={[styles.badge, styles.badgeCms]}>Create Content Type first</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{runner.cmsStatus}</Text>
          {runner.isVerifyingBackend && <ActivityIndicator size="small" />}
        </View>
      </View>

      {sectionNames.map((section) => (
        <View key={section} style={styles.section}>
          <Text style={styles.sectionTitle}>{section}</Text>
          {renderSectionInputs(section)}
          {cloudCodeDemos
            .filter((demo) => demo.section === section)
            .map((demo) => (
              <View key={demo.id}>
                <DemoRow demo={demo} disabled={runner.isRunning} onRun={handleRun} />
                <ResultCard
                  visible={runner.lastResultDemoId === demo.id}
                  title={runner.resultTitle}
                  text={runner.resultText}
                  expanded={runner.isResultExpanded}
                  onToggle={() => runner.setIsResultExpanded(!runner.isResultExpanded)}
                />
              </View>
            ))}
        </View>
      ))}

      {runner.isRunning && (
        <View style={styles.runningRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.runningText}>Calling Cloud Code...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 12,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  setupCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F0F0F3",
  },
  setupCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  badgeDatabase: {
    color: "#2864D2",
  },
  badgeCms: {
    color: "#7D4BB4",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statusText: {
    fontWeight: "700",
    marginRight: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputs: {
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  demoRow: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    alignItems: "center",
  },
  demoSlug: {
    fontSize: 14,
    fontWeight: "700",
    alignSelf: "flex-start",
  },
  demoDetail: {
    fontSize: 12,
    color: "#666",
    alignSelf: "flex-start",
    marginTop: 2,
  },
  demoPrerequisite: {
    fontSize: 11,
    color: "#999",
    alignSelf: "flex-start",
    marginBottom: 4,
    fontFamily: "Courier",
  },
  resultBox: {
    marginBottom: 10,
    marginTop: -4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    borderWidth: 1,
    borderColor: "#DDD",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultTitle: {
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  resultToggle: {
    color: "#007AFF",
    fontWeight: "600",
  },
  resultText: {
    fontFamily: "Courier",
    fontSize: 12,
    marginTop: 8,
  },
  runningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  runningText: {
    marginLeft: 8,
  },
});
