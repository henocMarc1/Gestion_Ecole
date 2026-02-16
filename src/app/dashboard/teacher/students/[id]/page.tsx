"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, ArrowLeft } from "lucide-react";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matricule?: string | null;
  email?: string | null;
  phone?: string | null;
  class_id?: string | null;
  class?: { name?: string | null };
  date_of_birth?: string | null;
  enrollment_date?: string | null;
  address?: string | null;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return;
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, matricule, email, phone, class_id, date_of_birth, enrollment_date, address")
        .eq("id", params.id)
        .single();
      if (error) {
        setError("Impossible de charger la fiche de l'étudiant");
        setLoading(false);
        return;
      }
      setStudent(data as Student);
      setLoading(false);
    };
    load();
  }, [params?.id, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement...
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Card className="border border-red-200 bg-red-50/80">
          <CardContent className="py-6 text-red-700">{error || "Étudiant introuvable"}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-sm text-neutral-600">Fiche élève</p>
        </div>
      </div>

      <Card className="border border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle>Identité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-neutral-800">
          <div className="flex flex-wrap items-center gap-2 text-neutral-700 text-xs break-all">
            <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-700">ID</span>
            <span>{student.id}</span>
            {student.matricule && (
              <span className="px-2 py-1 rounded bg-primary-50 text-primary-700 border border-primary-100">Matricule: {student.matricule}</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Info label="Nom complet" value={`${student.first_name} ${student.last_name}`} />
            <Info label="Classe" value={student.class_id || "-"} />
            <Info label="Date de naissance" value={formatDate(student.date_of_birth)} />
            <Info label="Date d'inscription" value={formatDate(student.enrollment_date)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-neutral-800">
          <Info label="Email" value={student.email} />
          <Info label="Téléphone" value={student.phone} />
          <Info label="Adresse" value={student.address} />
        </CardContent>
      </Card>

    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-sm text-neutral-800">{value || "-"}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR');
}
