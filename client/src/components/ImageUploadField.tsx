import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ImageUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string, key: string) => void;
}

export default function ImageUploadField({ label, value, onChange }: ImageUploadFieldProps) {
  const uploadMutation = trpc.cargos.uploadImage.useMutation();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const base64Data = base64.split(",")[1] || base64;

        await uploadMutation.mutateAsync({
          base64: base64Data,
          fileName: file.name,
          mimeType: file.type,
        });

        toast.success("Imagem enviada com sucesso!");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error("Erro ao fazer upload da imagem");
      console.error(err);
    }
  };

  return (
    <div className="mb-5">
      <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
      
      {value ? (
        <div className="relative rounded-lg overflow-hidden bg-slate-100 h-40 group">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <button
              type="button"
              onClick={() => onChange("", "")}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-red-500 text-white hover:bg-red-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <label className="block border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors cursor-pointer">
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-slate-400" />
            <p className="text-sm text-slate-600">Clique para selecionar uma imagem</p>
            <p className="text-xs text-slate-400">PNG, JPG ou GIF (máx. 5MB)</p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploadMutation.isPending}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
