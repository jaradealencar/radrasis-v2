import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Streamdown } from "streamdown";

interface CurriculumUploadSectionProps {
  cargoId: number;
  cargoTitulo: string;
}

export function CurriculumUploadSection({
  cargoId,
  cargoTitulo,
}: CurriculumUploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = trpc.curriculos.uploadAndAnalyze.useMutation();
  const listQuery = trpc.curriculos.listByCargo.useQuery({ cargoId });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const base64 = content.split(",")[1] || content;

        await uploadMutation.mutateAsync({
          cargoId,
          fileName: selectedFile.name,
          fileContent: base64,
          fileType: selectedFile.type || "application/pdf",
        });

        setSelectedFile(null);
        listQuery.refetch();
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Análise de Currículos - {cargoTitulo}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
              id="curriculum-input"
            />
            <label htmlFor="curriculum-input" className="cursor-pointer">
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">
                  {selectedFile
                    ? selectedFile.name
                    : "Clique para selecionar ou arraste um currículo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOC, DOCX ou TXT (máx. 10MB)
                </p>
              </div>
            </label>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Enviar e Analisar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {listQuery.data && listQuery.data.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Análises Realizadas</h3>
          {listQuery.data.map((analise) => (
            <Card key={analise.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {analise.curriculoFileName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(analise.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {analise.status === "concluido" && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {analise.status === "analisando" && (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    {analise.status === "erro" && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    {analise.status === "pendente" && (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {analise.status === "concluido" && analise.resultado && (
                  <div className="bg-muted p-4 rounded-lg prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{analise.resultado}</Streamdown>
                  </div>
                )}
                {analise.status === "erro" && analise.erroMensagem && (
                  <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg text-red-700 dark:text-red-200 text-sm">
                    <p className="font-medium">Erro na análise:</p>
                    <p>{analise.erroMensagem}</p>
                  </div>
                )}
                {analise.status === "analisando" && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <p>Analisando currículo...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
