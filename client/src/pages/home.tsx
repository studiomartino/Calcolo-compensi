import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { ColumnMapper, OPERATOR_COLORS } from "@/components/column-mapper";
import { DataTable } from "@/components/data-table";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { AnalysisArchive } from "@/components/analysis-archive";
import { OperatorsTab } from "@/components/operators-tab";
import { UsersTab } from "@/components/users-tab";
import { DuplicateModal, DuplicateRecord } from "@/components/duplicate-modal";
import { OperatorMappingModal, OperatorResolution } from "@/components/operator-mapping-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Table, BarChart3, Upload, Archive, FileSpreadsheet, Users as UsersIcon, Save, FileBarChart, UserCheck, Plus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import type { CompensoRecord, ColumnMapping, Analysis, CategoriaCompenso, Operator, OperatorAlias } from "@shared/schema";

const OPERATOR_COLORS_KEY = "operatorColors";

type ImportStep = "upload" | "mapping";
type AppView = "analyses" | "operators" | "users" | "import" | "analysis";

interface HomeProps {
  userRole: "admin" | "user";
}

export default function Home({ userRole }: HomeProps) {
  const [currentView, setCurrentView] = useState<AppView>("analyses");
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [currentDateRange, setCurrentDateRange] = useState<string>("");
  const [currentAnalysisName, setCurrentAnalysisName] = useState<string>("");
  const [openedAnalysisId, setOpenedAnalysisId] = useState<string | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [operatorColors, setOperatorColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(OPERATOR_COLORS_KEY);
    return saved ? JSON.parse(saved) : {};
  });
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateRecord[]>([]);
  const [pendingMappings, setPendingMappings] = useState<Record<string, string> | null>(null);
  const [operatorMappingOpen, setOperatorMappingOpen] = useState(false);
  const [pendingFieldMappings, setPendingFieldMappings] = useState<Record<string, string> | null>(null);
  const [pendingRawDataForImport, setPendingRawDataForImport] = useState<Record<string, string>[]>([]);
  const [excelOperatorsForModal, setExcelOperatorsForModal] = useState<string[]>([]);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [pendingAnalysisName, setPendingAnalysisName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleUpdateOperatorColors = useCallback((colors: Record<string, string>) => {
    setOperatorColors(colors);
    localStorage.setItem(OPERATOR_COLORS_KEY, JSON.stringify(colors));
  }, []);

  const assignRandomColors = useCallback((operators: string[]) => {
    const usedColors = new Set(Object.values(operatorColors));
    const availableColors = OPERATOR_COLORS.filter((c) => !usedColors.has(c.hex));
    const newColors = { ...operatorColors };
    
    operators.forEach((op) => {
      if (!newColors[op]) {
        if (availableColors.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableColors.length);
          newColors[op] = availableColors[randomIndex].hex;
          availableColors.splice(randomIndex, 1);
        } else {
          const randomIndex = Math.floor(Math.random() * OPERATOR_COLORS.length);
          newColors[op] = OPERATOR_COLORS[randomIndex].hex;
        }
      }
    });
    
    handleUpdateOperatorColors(newColors);
    return newColors;
  }, [operatorColors, handleUpdateOperatorColors]);

  const { data: records = [], isLoading: isLoadingRecords } = useQuery<CompensoRecord[]>({
    queryKey: ["/api/records"],
  });

  const { data: mappings = [] } = useQuery<ColumnMapping[]>({
    queryKey: ["/api/mappings"],
  });

  const { data: analyses = [], isLoading: isLoadingAnalyses } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const { data: managedOperators = [], refetch: refetchOperators } = useQuery<Operator[]>({
    queryKey: ["/api/operators"],
  });

  const { data: operatorAliases = [] } = useQuery<OperatorAlias[]>({
    queryKey: ["/api/operator-aliases"],
  });

  const importMutation = useMutation({
    mutationFn: async (data: { records: Record<string, string>[]; mappings: Record<string, string> }) => {
      const response = await apiRequest("POST", "/api/records/import", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      setCurrentDateRange(data.dateRange || "");
      setImportStep("upload");
      setRawData([]);
      setSourceColumns([]);
      setPendingAnalysisName(data.analysisName || "Analisi");
      setNameDialogOpen(true);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'importazione",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ ids, category }: { ids: string[]; category: CategoriaCompenso }) => {
      const response = await apiRequest("PATCH", "/api/records/bulk/update", { ids, updates: { categoriaCompenso: category } });
      return response.json();
    },
    onSuccess: (data: { updated: number; records: CompensoRecord[] }) => {
      queryClient.setQueryData<CompensoRecord[]>(["/api/records"], (oldRecords) => {
        if (!oldRecords) return oldRecords;
        const updatedMap = new Map(data.records.map(r => [r.id, r]));
        return oldRecords.map(record => updatedMap.get(record.id) || record);
      });
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string | number }) => {
      return apiRequest("PATCH", `/api/records/${id}`, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({
        title: "Record aggiornato",
        description: "Le modifiche sono state salvate",
      });
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: async ({ name, mappings }: { name: string; mappings: Record<string, string> }) => {
      return apiRequest("POST", "/api/mappings", { name, mappings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mappings"] });
      toast({
        title: "Mappatura salvata",
        description: "La mappatura è stata salvata per usi futuri",
      });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mappings"] });
      toast({
        title: "Mappatura eliminata",
        description: "La mappatura è stata eliminata",
      });
    },
  });

  const deleteAnalysisMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/analyses/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-status"] });
      if (id === openedAnalysisId) {
        setOpenedAnalysisId(null);
        setCurrentAnalysisName("");
        setCurrentDateRange("");
        setCurrentView("analyses");
      }
      toast({
        title: "Analisi eliminata",
        description: "L'analisi è stata rimossa dall'archivio",
      });
    },
  });

  const bulkDeleteAnalysesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", "/api/analyses/bulk-delete", { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-status"] });
      if (openedAnalysisId && ids.includes(openedAnalysisId)) {
        setOpenedAnalysisId(null);
        setCurrentAnalysisName("");
        setCurrentDateRange("");
        setCurrentView("analyses");
      }
      toast({
        title: "Analisi eliminate",
        description: "Le analisi selezionate sono state rimosse dall'archivio",
      });
    },
  });

  const renameAnalysisMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/analyses/${id}`, { name });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      if (openedAnalysisId === variables.id) {
        setCurrentAnalysisName(variables.name);
      }
      toast({
        title: "Analisi rinominata",
        description: `L'analisi è stata rinominata con successo`,
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il rinomino",
        variant: "destructive",
      });
    },
  });

  const archiveCurrentMutation = useMutation({
    mutationFn: async (name?: string) => {
      return apiRequest("POST", "/api/records/archive", name ? { name } : {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      setCurrentDateRange("");
      setCurrentAnalysisName("");
      setCurrentView("analyses");
      toast({
        title: "Analisi archiviata",
        description: "L'analisi corrente è stata archiviata con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'archiviazione",
        variant: "destructive",
      });
    },
  });

  const operators = useMemo(() => {
    const uniqueOperators = new Set(records.map((r) => r.operatore));
    return Array.from(uniqueOperators).sort();
  }, [records]);

  const handleDataLoaded = useCallback((data: Record<string, string>[], columns: string[]) => {
    setRawData(data);
    setSourceColumns(columns);
    setImportStep("mapping");
  }, []);

  const proceedToDuplicateCheck = useCallback(async (currentRawData: Record<string, string>[], fieldMappings: Record<string, string>) => {
    try {
      const response = await apiRequest("POST", "/api/records/check-duplicates", {
        records: currentRawData,
        mappings: fieldMappings,
      });
      const result = await response.json();
      
      if (result.hasDuplicates && result.duplicates.length > 0) {
        setDuplicates(result.duplicates);
        setPendingMappings(fieldMappings);
        setPendingRawDataForImport(currentRawData);
        setDuplicateModalOpen(true);
      } else {
        importMutation.mutate({
          records: currentRawData,
          mappings: fieldMappings,
        });
      }
    } catch (error) {
      importMutation.mutate({
        records: currentRawData,
        mappings: fieldMappings,
      });
    }
  }, [importMutation]);

  const handleMappingComplete = useCallback(async (fieldMappings: Record<string, string>) => {
    const operatorField = fieldMappings.operatore;
    const excelOperators: string[] = [];

    if (operatorField) {
      const operatorSet = new Set<string>();
      rawData.forEach((row) => {
        const op = row[operatorField];
        if (op && op.trim()) operatorSet.add(op.trim());
      });
      excelOperators.push(...Array.from(operatorSet));

      const operatorsWithoutColors = excelOperators.filter((op) => !operatorColors[op]);
      if (operatorsWithoutColors.length > 0) {
        assignRandomColors(operatorsWithoutColors);
      }
    }

    const officialNamesUpper = new Set(managedOperators.map((o) => o.name.toUpperCase()));

    const aliasMap = new Map<string, string>();
    operatorAliases.forEach((a) => {
      const op = managedOperators.find((o) => o.id === a.operatorId);
      if (op) aliasMap.set(a.alias.toUpperCase(), op.name);
    });

    const aliasSubstitutionMap = new Map<string, string>();
    excelOperators.forEach((op) => {
      const upper = op.toUpperCase();
      if (!officialNamesUpper.has(upper) && aliasMap.has(upper)) {
        aliasSubstitutionMap.set(op, aliasMap.get(upper)!);
      }
    });

    let dataForCheck = rawData;
    if (aliasSubstitutionMap.size > 0 && operatorField) {
      dataForCheck = rawData.map((row) => {
        const originalOp = row[operatorField]?.trim();
        if (originalOp && aliasSubstitutionMap.has(originalOp)) {
          return { ...row, [operatorField]: aliasSubstitutionMap.get(originalOp)! };
        }
        return row;
      });

      const resolvedOps = Array.from(new Set(aliasSubstitutionMap.values()));
      const newOpsForColors = resolvedOps.filter((op) => !operatorColors[op]);
      if (newOpsForColors.length > 0) {
        assignRandomColors(newOpsForColors);
      }
    }

    const unmatchedOperators = excelOperators.filter(
      (op) => !officialNamesUpper.has(op.toUpperCase()) && !aliasSubstitutionMap.has(op)
    );

    if (unmatchedOperators.length > 0) {
      setPendingFieldMappings(fieldMappings);
      setPendingRawDataForImport(dataForCheck);
      const remainingExcel = excelOperators.filter((op) => !aliasSubstitutionMap.has(op));
      setExcelOperatorsForModal(remainingExcel);
      setOperatorMappingOpen(true);
      return;
    }

    await proceedToDuplicateCheck(dataForCheck, fieldMappings);
  }, [rawData, managedOperators, operatorAliases, operatorColors, assignRandomColors, proceedToDuplicateCheck]);

  const handleOperatorMappingConfirm = useCallback(async (resolutions: OperatorResolution[]) => {
    if (!pendingFieldMappings) return;

    const operatorField = pendingFieldMappings.operatore;

    const createResolutions = resolutions.filter((r) => r.action === "create");
    for (const r of createResolutions) {
      try {
        const response = await apiRequest("POST", "/api/operators", { name: r.excelName });
        if (!response.ok && response.status !== 409) {
          toast({
            title: "Errore nella creazione dell'operatore",
            description: `Impossibile creare l'operatore "${r.excelName}". Riprovare.`,
            variant: "destructive",
          });
          return;
        }
      } catch {
        toast({
          title: "Errore di rete",
          description: `Impossibile creare l'operatore "${r.excelName}". Verificare la connessione.`,
          variant: "destructive",
        });
        return;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/operators"] });

    const associateResolutions = resolutions.filter((r) => r.action === "associate");
    const substitutionMap = new Map<string, string>();
    associateResolutions.forEach((r) => substitutionMap.set(r.excelName, r.officialName));

    for (const r of associateResolutions) {
      const operator = managedOperators.find((o) => o.name.toUpperCase() === r.officialName.toUpperCase());
      if (operator) {
        try {
          await apiRequest("POST", "/api/operator-aliases", {
            operatorId: operator.id,
            alias: r.excelName,
          });
        } catch {}
      }
    }
    if (associateResolutions.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-aliases"] });
    }

    let currentRawData = pendingRawDataForImport;
    if (substitutionMap.size > 0 && operatorField) {
      currentRawData = pendingRawDataForImport.map((row) => {
        const originalOp = row[operatorField]?.trim();
        if (originalOp && substitutionMap.has(originalOp)) {
          return { ...row, [operatorField]: substitutionMap.get(originalOp)! };
        }
        return row;
      });

      const substitutedOps = associateResolutions.map((r) => r.officialName);
      const newOpsForColors = substitutedOps.filter((op) => !operatorColors[op]);
      if (newOpsForColors.length > 0) {
        assignRandomColors(newOpsForColors);
      }
    }

    const fieldMappingsToUse = pendingFieldMappings;
    setPendingFieldMappings(null);
    setOperatorMappingOpen(false);

    await proceedToDuplicateCheck(currentRawData, fieldMappingsToUse);
  }, [pendingFieldMappings, pendingRawDataForImport, managedOperators, operatorColors, assignRandomColors, queryClient, toast, proceedToDuplicateCheck]);

  const handleOperatorMappingCancel = useCallback(() => {
    setOperatorMappingOpen(false);
    setPendingFieldMappings(null);
    setPendingRawDataForImport([]);
    setExcelOperatorsForModal([]);
  }, []);

  const handleImportWithExclusions = useCallback((excludeIndices: number[]) => {
    if (!pendingMappings) return;
    
    const excludeSet = new Set(excludeIndices);
    const sourceData = pendingRawDataForImport.length > 0 ? pendingRawDataForImport : rawData;
    const filteredRecords = sourceData.filter((_, index) => !excludeSet.has(index));
    
    importMutation.mutate({
      records: filteredRecords,
      mappings: pendingMappings,
    });
    
    setPendingMappings(null);
    setPendingRawDataForImport([]);
    setDuplicates([]);
  }, [rawData, pendingRawDataForImport, pendingMappings, importMutation]);

  const handleCategoryChange = useCallback((ids: string[], category: CategoriaCompenso) => {
    updateCategoryMutation.mutate({ ids, category });
  }, [updateCategoryMutation]);

  const handleRecordEdit = useCallback((id: string, field: keyof CompensoRecord, value: string | number) => {
    updateRecordMutation.mutate({ id, field, value });
  }, [updateRecordMutation]);

  const handleSaveMapping = useCallback((name: string, fieldMappings: Record<string, string>) => {
    saveMappingMutation.mutate({ name, mappings: fieldMappings });
  }, [saveMappingMutation]);

  const handleDeleteMapping = useCallback((id: string) => {
    deleteMappingMutation.mutate(id);
  }, [deleteMappingMutation]);

  const handleDeleteAnalysis = useCallback((id: string) => {
    deleteAnalysisMutation.mutate(id);
  }, [deleteAnalysisMutation]);

  const handleBulkDeleteAnalyses = useCallback((ids: string[]) => {
    bulkDeleteAnalysesMutation.mutate(ids);
  }, [bulkDeleteAnalysesMutation]);

  const handleRenameAnalysis = useCallback((id: string, newName: string) => {
    renameAnalysisMutation.mutate({ id, name: newName });
  }, [renameAnalysisMutation]);

  const handleOpenAnalysis = useCallback(async (analysis: Analysis) => {
    try {
      await apiRequest("POST", "/api/records/import", { 
        records: analysis.records.map(r => ({
          data: r.data || "",
          operatore: r.operatore,
          paziente: r.paziente,
          prestazione: r.prestazione,
          elementiDentali: r.elementiDentali,
          prezzoAlPaziente: r.prezzoAlPaziente.toString(),
          compensoOperatore: r.compensoOperatore.toString(),
          categoriaCompenso: r.categoriaCompenso,
        })),
        mappings: {
          data: "data",
          operatore: "operatore",
          paziente: "paziente",
          prestazione: "prestazione",
          elementiDentali: "elementiDentali",
          prezzoAlPaziente: "prezzoAlPaziente",
          compensoOperatore: "compensoOperatore",
        },
        preserveCategories: true,
        sourceAnalysisId: analysis.id,
      });
      
      await queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      setCurrentDateRange(analysis.dateRange);
      setCurrentAnalysisName(analysis.name);
      setOpenedAnalysisId(analysis.id);
      setCurrentView("analysis");
      
      toast({
        title: "Analisi caricata",
        description: `${analysis.name} aperta con successo`,
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'apertura dell'analisi",
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  const handleArchiveCurrent = useCallback(() => {
    archiveCurrentMutation.mutate(currentAnalysisName || undefined);
  }, [archiveCurrentMutation, currentAnalysisName]);

  const handleNameDialogConfirm = useCallback(async () => {
    try {
      const response = await apiRequest("POST", "/api/records/archive", {
        name: pendingAnalysisName,
        keepRecords: true,
      });
      const data = await response.json();
      const analysis = data.analysis;
      setOpenedAnalysisId(analysis.id);
      setCurrentAnalysisName(pendingAnalysisName);
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      setNameDialogOpen(false);
      setCurrentView("analysis");
      toast({
        title: "Importazione completata",
        description: `${pendingAnalysisName} pronta per l'analisi`,
      });
    } catch {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio dell'analisi",
        variant: "destructive",
      });
    }
  }, [pendingAnalysisName, queryClient, toast]);

  const handleNameDialogCancel = useCallback(async () => {
    setNameDialogOpen(false);
    setPendingAnalysisName("");
    setCurrentDateRange("");
    setCurrentAnalysisName("");
    try {
      await apiRequest("DELETE", "/api/records/clear");
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
    } catch {}
    setCurrentView("analyses");
  }, [queryClient]);

  const handleStartNewAnalysis = useCallback(() => {
    setImportStep("upload");
    setRawData([]);
    setSourceColumns([]);
    setCurrentView("import");
  }, []);

  const handleBackToAnalyses = useCallback(() => {
    setCurrentView("analyses");
  }, []);

  const roundToTen = (value: number): number => {
    return Math.round(value / 10) * 10;
  };

  const handleExportExcel = useCallback(() => {
    const operatorMap = new Map<string, CompensoRecord[]>();
    records.forEach((record) => {
      const existing = operatorMap.get(record.operatore) || [];
      existing.push(record);
      operatorMap.set(record.operatore, existing);
    });

    const reportData = Array.from(operatorMap.entries()).map(([operatore, operatorRecords]) => {
      const compensoTotale = operatorRecords.reduce((sum, r) => sum + r.compensoOperatore, 0);
      const compensoCard = operatorRecords
        .filter((r) => r.categoriaCompenso === "card")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const compensoCash = operatorRecords
        .filter((r) => r.categoriaCompenso === "cash")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const numeroAnomalie = operatorRecords.filter((r) => r.hasAnomaly).length;

      return {
        Operatore: operatore,
        "Numero Prestazioni": operatorRecords.length,
        "Compenso Totale": roundToTen(compensoTotale),
        "Compenso A": roundToTen(compensoCard),
        "Compenso B": roundToTen(compensoCash),
        "Anomalie": numeroAnomalie,
      };
    });

    const detailData = records.map((r) => ({
      "Categoria": r.categoriaCompenso === "card" ? "Compenso A" : "Compenso B",
      Data: r.data || "",
      Operatore: r.operatore,
      Paziente: r.paziente,
      Prestazione: r.prestazione,
      "Elementi Dentali": r.elementiDentali,
      "Prezzo Paziente": r.prezzoAlPaziente,
      "Compenso Operatore": r.compensoOperatore,
      Anomalia: r.hasAnomaly ? "Si" : "No",
    }));

    const workbook = XLSX.utils.book_new();
    
    const reportSheet = XLSX.utils.json_to_sheet(reportData);
    XLSX.utils.book_append_sheet(workbook, reportSheet, "Report Operatori");
    
    const detailSheet = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Dettaglio Prestazioni");

    XLSX.writeFile(workbook, `report-compensi-${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Export completato",
      description: "Il file Excel è stato scaricato",
    });
  }, [records, toast]);

  const sidebarItems = useMemo(() => {
    const items: { key: AppView; label: string; icon: typeof Archive }[] = [
      { key: "analyses", label: "Analisi salvate", icon: Archive },
      { key: "operators", label: "Operatori", icon: UserCheck },
    ];
    if (userRole === "admin") {
      items.push({ key: "users", label: "Utenti", icon: UsersIcon });
    }
    return items;
  }, [userRole]);

  const activeSidebarKey = currentView === "import" || currentView === "analysis" ? null : currentView;

  const renderImportContent = () => {
    if (importStep === "mapping") {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setImportStep("upload")} data-testid="button-back-to-upload">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Indietro
            </Button>
            <div>
              <h2 className="text-xl font-semibold">Mappatura Colonne</h2>
              <p className="text-muted-foreground text-sm">
                Associa le colonne del file ai campi dell'applicazione
              </p>
            </div>
          </div>

          <ColumnMapper
            sourceColumns={sourceColumns}
            rawData={rawData}
            savedMappings={mappings}
            onMappingComplete={handleMappingComplete}
            onSaveMapping={handleSaveMapping}
            onDeleteMapping={handleDeleteMapping}
            operatorColors={operatorColors}
            onUpdateOperatorColors={handleUpdateOperatorColors}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 pt-[20px] pb-[20px]">
        <div className="w-full max-w-2xl">
          <FileUpload onDataLoaded={handleDataLoaded} />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case "analyses":
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold" data-testid="text-analyses-title">Analisi salvate</h2>
                <p className="text-sm text-muted-foreground">
                  {analyses.length} {analyses.length === 1 ? "analisi archiviata" : "analisi archiviate"}
                </p>
              </div>
              <Button onClick={handleStartNewAnalysis} data-testid="button-new-analysis">
                <Plus className="mr-2 h-4 w-4" />
                Nuova analisi
              </Button>
            </div>
            <AnalysisArchive
              analyses={analyses}
              onDeleteAnalysis={handleDeleteAnalysis}
              onBulkDeleteAnalyses={handleBulkDeleteAnalyses}
              onOpenAnalysis={handleOpenAnalysis}
              onRenameAnalysis={handleRenameAnalysis}
              isLoading={isLoadingAnalyses}
            />
          </div>
        );

      case "import":
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="sm" onClick={handleBackToAnalyses} data-testid="button-back-to-analyses-from-import">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Analisi salvate
              </Button>
              <div>
                <h2 className="text-xl font-semibold">Nuova analisi</h2>
                <p className="text-sm text-muted-foreground">Importa un file per creare una nuova analisi</p>
              </div>
            </div>
            {renderImportContent()}
          </div>
        );

      case "analysis":
        return (
          <div className="flex-1 flex flex-col min-h-0 w-full">
            <div className="flex items-center justify-between gap-4 flex-wrap pb-4 shrink-0">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={handleBackToAnalyses} data-testid="button-back-to-analyses">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Analisi salvate
                </Button>
                <div>
                  <h2 className="text-lg font-semibold" data-testid="text-analysis-name">{currentAnalysisName || "Analisi"}</h2>
                  <p className="text-muted-foreground text-sm">
                    {currentDateRange && `Periodo: ${currentDateRange}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-archive-current" className="h-8 text-xs">
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Salva
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archiviare l'analisi corrente?</AlertDialogTitle>
                      <AlertDialogDescription>
                        L'analisi corrente con {records.length} record verrà spostata nell'archivio.
                        I dati saranno rimossi dalla vista corrente ma resteranno accessibili nell'archivio.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={handleArchiveCurrent} data-testid="button-confirm-archive">
                        Archivia
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Sheet open={isReportOpen} onOpenChange={setIsReportOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm" data-testid="button-open-reports" className="h-8 text-xs">
                      <FileBarChart className="mr-1.5 h-3.5 w-3.5" />
                      Report
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Report Operatori
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <OperatorDashboard
                        records={records}
                        onExportExcel={handleExportExcel}
                        selectedOperator={selectedOperator}
                        onSelectOperator={setSelectedOperator}
                        onUpdateRecord={(id, compensoOperatore) => handleRecordEdit(id, "compensoOperatore", compensoOperatore)}
                        dateRange={currentDateRange}
                        operatorColors={operatorColors}
                        managedOperators={managedOperators}
                        analysisId="current"
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            {isLoadingRecords ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Caricamento dati...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium">Nessun dato disponibile</h3>
                  <p className="text-muted-foreground">
                    Importa un file per visualizzare l'analisi dei compensi
                  </p>
                </div>
                <Button onClick={handleStartNewAnalysis} data-testid="button-go-to-import">
                  <Upload className="mr-2 h-4 w-4" />
                  Nuova analisi
                </Button>
              </div>
            ) : (
              <DataTable
                records={records}
                operators={operators}
                onCategoryChange={handleCategoryChange}
                onRecordEdit={handleRecordEdit}
              />
            )}
          </div>
        );

      case "operators":
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <OperatorsTab
              analyses={analyses}
              operatorColors={operatorColors}
              onUpdateOperatorColors={handleUpdateOperatorColors}
              managedOperators={managedOperators}
              onRefreshOperators={() => refetchOperators()}
            />
          </div>
        );

      case "users":
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <UsersTab />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-background overflow-hidden">
      <aside className="w-56 shrink-0 border-r bg-sidebar flex flex-col">
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSidebarKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setCurrentView(item.key)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
                data-testid={`sidebar-${item.key}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
                {item.key === "analyses" && (
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {analyses.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex-1 p-6 min-h-0 flex flex-col">
          {renderContent()}
        </div>
      </div>

      <DuplicateModal
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
        duplicates={duplicates}
        onImportSelected={handleImportWithExclusions}
        totalRecords={pendingRawDataForImport.length > 0 ? pendingRawDataForImport.length : rawData.length}
      />

      <OperatorMappingModal
        open={operatorMappingOpen}
        onOpenChange={(open) => { if (!open) handleOperatorMappingCancel(); else setOperatorMappingOpen(true); }}
        excelOperators={excelOperatorsForModal}
        officialOperators={managedOperators}
        onConfirm={handleOperatorMappingConfirm}
      />

      <Dialog open={nameDialogOpen} onOpenChange={(open) => { if (!open) handleNameDialogCancel(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conferma nome analisi</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Puoi modificare il nome dell'analisi prima di proseguire.
          </p>
          <Input
            value={pendingAnalysisName}
            onChange={(e) => setPendingAnalysisName(e.target.value)}
            placeholder="Nome analisi"
            data-testid="input-analysis-name"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleNameDialogCancel} data-testid="button-name-dialog-cancel">
              Annulla
            </Button>
            <Button onClick={handleNameDialogConfirm} disabled={!pendingAnalysisName.trim()} data-testid="button-name-dialog-confirm">
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
