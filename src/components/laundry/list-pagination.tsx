import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { LIST_PAGE_SIZES } from "@/lib/laundry-pagination"

interface ListPaginationProps {
  page: number
  pageSize: number
  total: number
  /** How many rows are actually shown on this page (last rendered page can be short). */
  shown: number
  onPageChange: (page: number) => void
  /** The parent resets to page 1 (page 0) when the size changes. */
  onPageSizeChange: (size: number) => void
}

/** Compact 50/100 pagination footer shared by the laundry list screens. */
export function ListPagination({ page, pageSize, total, shown, onPageChange, onPageSizeChange }: ListPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 text-sm text-slate-500 mt-4">
      <span>
        Showing {page * pageSize + 1}–{Math.min(total, page * pageSize + shown)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <label className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
          Rows
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[68px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIST_PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-xs">
          Page {page + 1} / {pages}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page + 1 >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}