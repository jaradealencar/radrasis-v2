import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { ChevronDown, X } from "lucide-react";

interface MultipleRetrabalhosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (errorIds: number[]) => void;
  tipoRegistro?: "retrabalho" | "cnq";
}

export function MultipleRetrabalhosSelector({
  open,
  onOpenChange,
  onSelect,
  tipoRegistro = "retrabalho",
}: MultipleRetrabalhosProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { data: errorLibrary = [] } = trpc.errorLibrary.list.useQuery();

  // Filtrar por tipo e busca
  const filteredErrors = useMemo(() => {
    return errorLibrary
      .filter((e) => e.tipoRegistro === tipoRegistro)
      .filter(
        (e) =>
          e.code.toLowerCase().includes(search.toLowerCase()) ||
          e.description.toLowerCase().includes(search.toLowerCase()) ||
          e.category.toLowerCase().includes(search.toLowerCase())
      );
  }, [errorLibrary, search, tipoRegistro]);

  // Agrupar por categoria
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredErrors>();
    filteredErrors.forEach((e) => {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    });
    return map;
  }, [filteredErrors]);

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  };

  const toggleError = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (selectedIds.length > 0) {
      onSelect(selectedIds);
      setSelectedIds([]);
      setSearch("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setSelectedIds([]);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar Múltiplos Retrabalhos</DialogTitle>
          <DialogDescription>
            Escolha dois ou mais erros para lançar como um lote combinado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca */}
          <Input
            placeholder="Buscar por código, descrição ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />

          {/* Lista de erros */}
          <ScrollArea className="h-96 border rounded-lg p-4">
            {grouped.size === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Nenhum erro encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from(grouped.entries()).map(([category, errors]) => (
                  <div key={category} className="space-y-2">
                    {/* Header da categoria */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="flex items-center gap-2 w-full p-2 hover:bg-gray-100 rounded font-semibold text-sm"
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${
                          expandedCategories.has(category) ? "" : "-rotate-90"
                        }`}
                      />
                      {category} ({errors.length})
                    </button>

                    {/* Itens da categoria */}
                    {expandedCategories.has(category) && (
                      <div className="ml-6 space-y-2">
                        {errors.map((error) => (
                          <label
                            key={error.id}
                            className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedIds.includes(error.id)}
                              onCheckedChange={() => toggleError(error.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-xs text-gray-600">
                                {error.code}
                              </div>
                              <div className="text-sm text-gray-900">
                                {error.description}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Resumo de seleção */}
          {selectedIds.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm font-semibold text-blue-900">
                {selectedIds.length} erro(s) selecionado(s)
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedIds.map((id) => {
                  const error = errorLibrary.find((e) => e.id === id);
                  return error ? (
                    <div
                      key={id}
                      className="bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs flex items-center gap-1"
                    >
                      {error.code}
                      <button
                        onClick={() => toggleError(id)}
                        className="hover:text-blue-700"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedIds.length < 2}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar ({selectedIds.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
