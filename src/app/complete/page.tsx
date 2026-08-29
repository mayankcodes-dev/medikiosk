"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KioskScreen } from "@/components/kiosk/KioskLayout";
import { Button } from "@/components/ui/primitives";
import { MediKioskLogo } from "@/components/kiosk/KioskLayout";

export default function CompletePage() {
  const router = useRouter();

  return (
    <KioskScreen centered>
      <div className="flex flex-col items-center gap-8 px-8 text-center max-w-sm">
        {/* Success animation */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="h-28 w-28 rounded-full bg-success-50 border-4 border-success-200
                     flex items-center justify-center text-6xl"
        >
          ✅
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h1 className="text-3xl font-extrabold text-neutral-900">
            बहुत अच्छा! 🎉
          </h1>
          <p className="text-2xl font-bold text-success-600">
            All Done!
          </p>
          <p className="text-neutral-600 leading-relaxed">
            आपकी जानकारी डॉक्टर के पास भेज दी गई है।
            <br />
            Your summary has been sent to the doctor.
          </p>
        </motion.div>

        {/* Token reminder */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-brand-50 border border-brand-200 rounded-2xl p-5 w-full"
        >
          <p className="text-sm text-brand-600 font-semibold mb-1">
            आपका टोकन नंबर / Your Token:
          </p>
          <p className="text-5xl font-extrabold text-brand-700 tracking-wider">
            A-042
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            Screen पर अपना नंबर देखें / Watch the screen for your number
          </p>
        </motion.div>

        {/* ABHA reminder */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4 w-full text-sm"
        >
          <p className="text-neutral-600">
            🔒 आपका रिकॉर्ड आपके <strong>ABHA</strong> में सेव हो गया।
            <br />
            Record saved to your ABHA health account.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="w-full space-y-3"
        >
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => {
              // Clear session data
              sessionStorage.clear();
              router.push("/");
            }}
          >
            🏠 &nbsp;नई शुरुआत / New Patient
          </Button>
          <p className="text-xs text-neutral-400 text-center">
            आपका session डेटा अब हटा दिया गया है।
            <br />
            Session data has been cleared for your privacy.
          </p>
        </motion.div>

        <MediKioskLogo size="sm" className="opacity-40 mt-4" />
      </div>
    </KioskScreen>
  );
}
