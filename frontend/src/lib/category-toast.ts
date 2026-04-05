import { toast } from "sonner"

export function showCategoryAssignToast(
  eventType: string,
  onAssign: () => void
) {
  toast("该事项尚未归类", {
    description: `"${eventType}" 当前为未分类`,
    action: {
      label: "去分类",
      onClick: onAssign,
    },
    duration: 6000,
  })
}
