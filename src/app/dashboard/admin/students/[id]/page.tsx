"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Loader2, List } from "lucide-react";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matricule?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  class_id?: string | null;
  enrollment_date?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  class?: { name?: string | null };
}

interface ParentLink {
  parent: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  relationship?: string | null;
  is_primary_contact?: boolean | null;
}

export default function AdminStudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [student, setStudent] = useState<Student | null>(null);
  const [parents, setParents] = useState<ParentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("students")
          .select("id, first_name, last_name, matricule, date_of_birth, gender, class_id, enrollment_date, address, email, phone, class:classes(name)")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setStudent(data as Student);

        const { data: links, error: parentsError } = await supabase
          .from("parents_students")
          .select("relationship, is_primary_contact, parent:users(id, full_name, email, phone)")
          .eq("student_id", params.id);

        if (parentsError) throw parentsError;
        // Mapper les données pour que 'parent' soit un objet au lieu d'un array
        const formattedParents = (links || []).map((link: any) => ({
          relationship: link.relationship,
          is_primary_contact: link.is_primary_contact,
          parent: Array.isArray(link.parent) && link.parent.length > 0 
            ? link.parent[0] 
            : link.parent as any
        }));
        setParents(formattedParents);
      } catch (e) {
        console.error(e);
        setError("Impossible de charger la fiche de l'élève");
      } finally {
        setLoading(false);
      }
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
          <p className="text-sm text-neutral-600">Fiche élève (admin)</p>
        </div>
      </div>

      <Card className="border border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
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
            <Info label="Classe" value={student.class?.name} />
            <Info label="Genre" value={student.gender} />
            <Info label="Date de naissance" value={student.date_of_birth} />
            <Info label="Date d'inscription" value={student.enrollment_date} />
            <Info label="Email" value={student.email} />
            <Info label="Téléphone" value={student.phone} />
            <Info label="Adresse" value={student.address} />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle>Parents / Tuteurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-neutral-800">
          {parents.length === 0 ? (
            <p className="text-neutral-600">Aucun parent associé.</p>
          ) : (
            parents.map((link, idx) => (
              <div key={idx} className="border border-neutral-100 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <p className="font-medium text-neutral-900">{link.parent?.full_name || "Parent"}</p>
                  {link.is_primary_contact ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-50 text-green-700 border border-green-100">Contact principal</span>
                  ) : null}
                  {link.relationship ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{link.relationship}</span>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-neutral-700">
                  <Info label="Email" value={link.parent?.email} />
                  <Info label="Téléphone" value={link.parent?.phone} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/admin/students" className="inline-flex items-center gap-2 text-primary-700 hover:underline text-sm">
          <List className="h-4 w-4" /> Retour à la liste
        </Link>
      </div>
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
