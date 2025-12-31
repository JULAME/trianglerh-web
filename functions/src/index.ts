import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Corre cada minuto.
 * Lee notificationQueue (sendAt <= ahora, sent=false),
 * manda push y marca como sent.
 */
export const sendQueuedNotifications = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Mexico_City",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snap = await db
      .collection("notificationQueue")
      .where("sent", "==", false)
      .where("sendAt", "<=", now)
      .orderBy("sendAt", "asc")
      .limit(50)
      .get();

    if (snap.empty) return;

    for (const jobDoc of snap.docs) {
      const job = jobDoc.data() as any;
      const uid: string = job.uid;

      try {
        const tokensSnap = await db.collection(`users/${uid}/fcmTokens`).get();
        const tokens = tokensSnap.docs.map((d) => d.id).filter(Boolean);

        if (tokens.length === 0) {
          await jobDoc.ref.update({
            sent: true,
            sentAt: admin.firestore.Timestamp.now(),
            result: "no_tokens",
          });
          continue;
        }

        const message: admin.messaging.MulticastMessage = {
          tokens,
          notification: {
            title: job.title || "TriangleRH",
            body: job.body || "Notificación",
          },
          data: {
            type: job.type || "schedule",
            uid,
            jobId: jobDoc.id,
          },
        };

        const resp = await admin.messaging().sendEachForMulticast(message);

        const badTokens: string[] = [];
        resp.responses.forEach((r, i) => {
          if (!r.success) {
            const code = (r.error as any)?.code || "";
            if (
              code.includes("registration-token-not-registered") ||
              code.includes("invalid-registration-token")
            ) {
              badTokens.push(tokens[i]);
            }
          }
        });

        const batch = db.batch();
        badTokens.forEach((t) =>
          batch.delete(db.doc(`users/${uid}/fcmTokens/${t}`))
        );

        batch.update(jobDoc.ref, {
          sent: true,
          sentAt: admin.firestore.Timestamp.now(),
          successCount: resp.successCount,
          failureCount: resp.failureCount,
          result: "sent",
        });

        await batch.commit();
      } catch (err: any) {
        await jobDoc.ref.update({
          sent: true,
          sentAt: admin.firestore.Timestamp.now(),
          result: "error",
          errorMessage: String(err?.message || err),
        });
      }
    }
  }
);
