import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";
import {
  CategorizationRule,
  RuleCategory,
  RuleMatchType,
  RuleOperator,
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

  const [useSecond, setUseSecond] = useState(false);
  const [operator, setOperator] = useState<RuleOperator>("AND");
  const [pattern2, setPattern2] = useState("");
  const [matchType2, setMatchType2] = useState<RuleMatchType>("contains");

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
    if (useSecond && !pattern2.trim()) {
      toast.error("Introduce el segundo texto a buscar");
      return;
    }
    const newRule: CategorizationRule = {
      id: crypto.randomUUID(),
      pattern: pattern.trim(),
      matchType,
      category,
      ...(useSecond
        ? { operator, pattern2: pattern2.trim(), matchType2 }
        : {}),
    };
    persist([...rules, newRule]);
    setPattern("");
    setPattern2("");
    setUseSecond(false);
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
              Las reglas se evalúan en orden de arriba a abajo. La primera coincidencia define la categoría. Puedes concatenar dos condiciones con AND u OR.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr,2fr] gap-3 items-end">
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
                />
              </div>
            </div>

            {useSecond ? (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Operador</Label>
                    <Select value={operator} onValueChange={(v) => setOperator(v as RuleOperator)}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AND">Y (AND)</SelectItem>
                        <SelectItem value="OR">O (OR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setUseSecond(false)}>
                    <X className="h-4 w-4 mr-1" /> Quitar
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr,2fr] gap-3 items-end">
                  <div>
                    <Label>2ª condición</Label>
                    <Select value={matchType2} onValueChange={(v) => setMatchType2(v as RuleMatchType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>2º texto</Label>
                    <Input
                      value={pattern2}
                      onChange={(e) => setPattern2(e.target.value)}
                      placeholder="Ej: PAGO"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setUseSecond(true)}>
                <Plus className="h-4 w-4 mr-2" /> Añadir 2ª condición
              </Button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3 items-end">
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
                <Plus className="h-4 w-4 mr-2" /> Añadir regla
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reglas activas ({rules.length})</CardTitle>
            <CardDescription>
              Si ninguna regla coincide, el movimiento se clasifica como <strong>Diario</strong>.
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
                    className="flex items-center gap-2 p-3 border rounded-lg flex-wrap"
                  >
                    <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                    <Badge variant="outline">{MATCH_TYPE_LABELS[rule.matchType]}</Badge>
                    <span className="font-mono text-sm truncate">"{rule.pattern}"</span>
                    {rule.operator && rule.pattern2 && rule.matchType2 && (
                      <>
                        <Badge variant="secondary">{rule.operator === "AND" ? "Y" : "O"}</Badge>
                        <Badge variant="outline">{MATCH_TYPE_LABELS[rule.matchType2]}</Badge>
                        <span className="font-mono text-sm truncate">"{rule.pattern2}"</span>
                      </>
                    )}
                    <div className="flex-1" />
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
