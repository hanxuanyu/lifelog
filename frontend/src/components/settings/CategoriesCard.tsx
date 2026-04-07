import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Trash2, Save, Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getCategories, updateCategories } from "@/api"
import type { Category } from "@/types"
import { toast } from "sonner"

interface CategoriesCardProps {
  refreshKey?: number
}

export function CategoriesCard({ refreshKey }: CategoriesCardProps) {
  const [categories, setCategoriesState] = useState<Category[]>([])
  const [origCategories, setOrigCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCategories().then((cats) => {
      const c = cats || []
      setCategoriesState(c)
      setOrigCategories(JSON.parse(JSON.stringify(c)))
    }).catch(() => {})
  }, [refreshKey])

  const dirty = JSON.stringify(categories) !== JSON.stringify(origCategories)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateCategories(categories)
      setOrigCategories(JSON.parse(JSON.stringify(categories)))
      toast.success("分类规则已保存并实时生效")
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "保存失败"
      toast.error("保存失败", { description: msg })
    } finally { setSaving(false) }
  }

  const addCategory = () => setCategoriesState([...categories, { name: "", color: "#6b7280", rules: [{ type: "fixed", pattern: "" }] }])
  const removeCategory = (i: number) => setCategoriesState(categories.filter((_, idx) => idx !== i))

  const updateCategoryName = (i: number, name: string) => {
    const u = [...categories]; u[i] = { ...u[i], name }; setCategoriesState(u)
  }
  const updateCategoryColor = (i: number, color: string) => {
    const u = [...categories]; u[i] = { ...u[i], color }; setCategoriesState(u)
  }
  const addRule = (ci: number) => {
    const u = [...categories]; u[ci] = { ...u[ci], rules: [...u[ci].rules, { type: "fixed", pattern: "" }] }; setCategoriesState(u)
  }
  const removeRule = (ci: number, ri: number) => {
    const u = [...categories]; u[ci] = { ...u[ci], rules: u[ci].rules.filter((_, i) => i !== ri) }; setCategoriesState(u)
  }
  const updateRule = (ci: number, ri: number, field: "type" | "pattern", value: string) => {
    const u = [...categories]; const rules = [...u[ci].rules]; rules[ri] = { ...rules[ri], [field]: value }; u[ci] = { ...u[ci], rules }; setCategoriesState(u)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> 分类规则</CardTitle>
                <CardDescription className="text-xs mt-1">编辑分类及匹配规则（保存后实时生效）</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addCategory}><Plus className="h-3.5 w-3.5 mr-1" /> 添加分类</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {categories.map((cat, catIdx) => (
                  <motion.div key={cat.name || `cat-${catIdx}`} layout="position"
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8 shrink-0">
                        <div className="w-8 h-8 rounded-md border border-input shadow-sm" style={{ backgroundColor: cat.color || "#6b7280" }} />
                        <input type="color" value={cat.color || "#6b7280"} onChange={(e) => updateCategoryColor(catIdx, e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                      <Input value={cat.name} onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                        placeholder="分类名称" className="font-medium text-sm flex-1" />
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeCategory(catIdx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="space-y-2 pl-2 border-l-2 border-muted ml-1">
                      <AnimatePresence mode="popLayout">
                        {cat.rules.map((rule, ruleIdx) => (
                          <motion.div key={ruleIdx} layout initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-2">
                            <select value={rule.type} onChange={(e) => updateRule(catIdx, ruleIdx, "type", e.target.value)}
                              className="h-9 rounded-md border border-input bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0 w-[68px]">
                              <option value="fixed">精确</option>
                              <option value="regex">正则</option>
                            </select>
                            <Input value={rule.pattern} onChange={(e) => updateRule(catIdx, ruleIdx, "pattern", e.target.value)}
                              placeholder={rule.type === "fixed" ? "精确匹配值" : "正则表达式"} className="text-xs font-mono flex-1" />
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeRule(catIdx, ruleIdx)}><X className="h-3 w-3" /></Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground"
                        onClick={() => addRule(catIdx)}><Plus className="h-3 w-3 mr-1" /> 添加规则</Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">暂无分类规则，点击上方按钮添加</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-1.5" />{saving ? "保存中..." : "保存分类规则"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
