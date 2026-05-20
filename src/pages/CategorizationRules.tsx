import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  CategorizationRule,
  RuleCategory,
  RuleMatchType,
  CATEGORY_LABELS,
  MATCH_TYPE_LABELS,
  loadCategorizationRules,
  saveCategorizationRules,
  categorizeDescription,
} from "@/lib/categorizationRules";

const CategorizationRules = () => {
  const navigate = useNavigate();
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<RuleMatchType>("contains");
  const [category, setCategory] = useState<RuleCategory>("fixed");
  const [testText, setTestText] = useState("");

  useEffect(() => {
    setRules(loadCategorizationRules());
  }, []);

  const persist = (next: CategorizationRule[]) => {
    setRules(next);
    saveCategorizationRules(next);
  };

  const handleAdd = () => {
    if (!pattern.trim()) {
      toast.error("Introduce un texto a buscar");
      return;
    }
    const next: CategorizationRule[] = [
      ...rules,
      { id: crypto.randomUUID(), pattern: pattern.trim(), matchType, category },
    ];
    persist(next);
    setPattern("");
    toast.success("Regla añadida");
  };

  const handleDelete = (id: string) => {
    persist(rules.filter((r) => r.id !== id));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  };

  const testResult = testText.trim() ? categorizeDescription(testText, rules) : null;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Reglas de categorización</h1>
            <p className="text-muted-foreground">
              Define cómo clasificar los movimientos importados del banco según su descripción.
            </p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Nueva regla</CardTitle>
            <CardDescription>
              Las reglas se evalúan en orden de arriba a abajo. La primera coincidencia define la categoría.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,1fr,auto] gap-3 items-end">
              <div>
                <Label>Condición</Label>
                <Select value={matchType} onValueChange={(v) => setMatchType(v as RuleMatchType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Texto</Label>
                <Input
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="Ej: MERCADONA"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as RuleCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" /> Añadir
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reglas activas ({rules.length})</CardTitle>
            <CardDescription>
              Si ninguna regla coincide, el movimiento se clasifica como <strong>Extra</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No hay reglas. Añade alguna arriba para empezar.
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-2 p-3 border rounded-lg"
                  >
                    <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                    <Badge variant="outline">{MATCH_TYPE_LABELS[rule.matchType]}</Badge>
                    <span className="font-mono text-sm flex-1 truncate">"{rule.pattern}"</span>
                    <Badge>{CATEGORY_LABELS[rule.category]}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => move(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => move(idx, 1)} disabled={idx === rules.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Probar regla</CardTitle>
            <CardDescription>Escribe una descripción para ver qué categoría se asignaría.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Ej: PAGO MERCADONA SA"
            />
            {testResult && (
              <p className="text-sm">
                Se clasificaría como: <Badge>{CATEGORY_LABELS[testResult]}</Badge>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CategorizationRules;
