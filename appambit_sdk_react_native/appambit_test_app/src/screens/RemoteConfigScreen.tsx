import { useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import {
    getString,
    getBoolean,
    getInt,
    getDouble,
} from "appambit";

export default function RemoteConfigScreen() {
    const [data, setData] = useState<string>("");
    const [showBanner, setShowBanner] = useState<boolean>(false);
    const [discount, setDiscount] = useState<number>(0);
    const [maxUpload, setMaxUpload] = useState<number>(0);

    useEffect(() => {
        loadRemoteConfig();
    }, []);

    const loadRemoteConfig = () => {
        const remoteData = getString("data");
        const remoteBanner = getBoolean("banner");
        const remoteDiscount = getInt("discount");
        const remoteMaxUpload = getDouble("max_upload");

        setData(remoteData);
        setShowBanner(remoteBanner);
        setDiscount(remoteDiscount);
        setMaxUpload(remoteMaxUpload);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Banner Card */}
            {showBanner && (
                <View style={styles.bannerCard}>
                    <View style={styles.bannerBadge}>
                        <Text style={styles.bannerBadgeText}>NEW FEATURE</Text>
                    </View>
                    <Text style={styles.bannerDescription}>
                        Discover what we have prepared for you in this new update enabled by
                        Remote Config.
                    </Text>
                </View>
            )}

            {/* Message of the Day Card */}
            <View style={styles.messageCard}>
                <Text style={styles.cardLabel}>MESSAGE OF THE DAY</Text>
                <Text style={styles.messageText}>
                    {data && data.length > 0
                        ? data
                        : "You're without Remote values"}
                </Text>
            </View>

            {/* Discount Card */}
            {discount > 0 && (
                <View style={styles.discountCard}>
                    <View style={styles.discountLeft}>
                        <Text style={styles.discountLabel}>SPECIAL OFFER</Text>
                        <Text style={styles.discountSubtitle}>Get your discount now!</Text>
                    </View>
                    <Text style={styles.discountValue}>{discount}% OFF</Text>
                </View>
            )}

            {/* Upload Limit Card */}
            <View style={styles.uploadCard}>
                <Text style={styles.uploadLabel}>UPLOAD LIMIT</Text>
                <View style={styles.uploadRow}>
                    <Text style={styles.uploadDescription}>Max file size allowed:</Text>
                    <Text style={styles.uploadValue}>
                        {maxUpload > 0 ? `${maxUpload.toFixed(1)} MB` : "100 MB"}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
    },
    content: {
        padding: 24,
        paddingTop: 32,
    },
    // Banner Card
    bannerCard: {
        backgroundColor: "#F66A0A",
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    bannerBadge: {
        backgroundColor: "#C34700",
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 12,
    },
    bannerBadgeText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 1,
    },
    bannerDescription: {
        color: "#E3F2FD",
        fontSize: 14,
        lineHeight: 20,
    },
    // Message Card
    messageCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    cardLabel: {
        color: "#757575",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 1,
        marginBottom: 12,
    },
    messageText: {
        color: "#212121",
        fontSize: 18,
        fontWeight: "500",
        lineHeight: 24,
    },
    // Discount Card
    discountCard: {
        backgroundColor: "#E8F5E9",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        flexDirection: "row",
        alignItems: "center",
    },
    discountLeft: {
        flex: 1,
    },
    discountLabel: {
        color: "#2E7D32",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 1,
        marginBottom: 4,
    },
    discountSubtitle: {
        color: "#1B5E20",
        fontSize: 16,
        fontWeight: "bold",
    },
    discountValue: {
        color: "#2E7D32",
        fontSize: 32,
        fontWeight: "bold",
    },
    // Upload Card
    uploadCard: {
        backgroundColor: "#E3F2FD",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    uploadLabel: {
        color: "#1565C0",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 1,
        marginBottom: 8,
    },
    uploadRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    uploadDescription: {
        flex: 1,
        color: "#0D47A1",
        fontSize: 16,
    },
    uploadValue: {
        color: "#1565C0",
        fontSize: 20,
        fontWeight: "bold",
    },
});
