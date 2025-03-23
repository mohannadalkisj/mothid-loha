"use client";

import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firestore";

interface PersonalInfo {
  name: string;
  id: string;
  address: string;
  phone: string;
}

interface Data {
  id: string;
  ip: string;
  data: {
    personalInfo: PersonalInfo;
  };
}

export default function PersonalInfoDisplay({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const docRef = doc(db, "users", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData(docSnap.data() as Data);
        } else {
          setError("No such document!");
        }
      } catch (err) {
        setError("Error fetching document: " + (err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data found</div>;

  return (
    <div className="p-4 max-w-md mx-auto rounded-xl shadow-md">
      {data.data.personalInfo && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold mt-4">معلومات زبي:</h3>
          <p>
            <strong>الاسم:</strong> {data.data.personalInfo.name}
          </p>
          <p>
            <strong> ID:</strong> {data.data.personalInfo.id}
          </p>
          <p>
            <strong>العنوان:</strong> {data.data.personalInfo.address}
          </p>
          <p>
            <strong>هاتف:</strong> {data.data.personalInfo.phone}
          </p>
        </div>
      )}
    </div>
  );
}
