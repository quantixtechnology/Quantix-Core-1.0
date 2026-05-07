"use client";

// ============================================================================
// Quantix Core — Thermal Print Dialog (Updated)
// Dialog for configuring and printing thermal receipts
// Paper size selector (58mm, 80mm, A4), preview with V2 receipt,
// print via print-utils, download as text/HTML
// ============================================================================

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Printer,
  Download,
  Eye,
  QrCode,
  Bluetooth,
  Usb,
  FileText,
  Monitor,
  FileDown,
} from "lucide-react";
import { ThermalReceiptV2 } from "@/components/business/pos/thermal-receipt-v2";
import type { ReceiptOrder, ReceiptBusiness, ReceiptStore } from "@/components/business/pos/thermal-receipt-v2";
import { printReceipt, generatePrintHTML, getPrintStyles } from "@/lib/print-utils";
import { generateThermalReceipt } from "@/lib/core/pos";
import { numberToWords } from "@/lib/core/pos";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

type PaperSize = "58mm" | "80mm" | "A4";
type PrinterType = "thermal_usb" | "thermal_bluetooth" | "laser";

interface ThermalPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ReceiptOrder;
  business: ReceiptBusiness;
  store?: ReceiptStore;
  defaultPaperSize?: PaperSize;
  onPrintComplete?: () => void;
}

// ============================================================================
// Paper size descriptions
// ============================================================================

const PAPER_SIZE_INFO: Record<PaperSize, { label: string; desc: string; chars: string; icon: typeof Printer }> = {
  "58mm": {
    label: "58mm Mini",
    desc: "32 chars/line — compact portable printers",
    chars: "32 chars/line",
    icon: Bluetooth,
  },
  "80mm": {
    label: "80mm Standard",
    desc: "48 chars/line — standard POS printers",
    chars: "48 chars/line",
    icon: Usb,
  },
  A4: {
    label: "A4 Full Page",
    desc: "Full page — detailed invoice with GST breakdown",
    chars: "80 chars/line",
    icon: Monitor,
  },
};

// ============================================================================
// Component
// ============================================================================

export function ThermalPrintDialog({
  open,
  onOpenChange,
  order,
  business,
  store,
  defaultPaperSize = "80mm",
  onPrintComplete,
}: ThermalPrintDialogProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>(defaultPaperSize);
  const [printerType, setPrinterType] = useState<PrinterType>("thermal_usb");
  const [showQR, setShowQR] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Unique ID for the receipt element
  const receiptElementId = "thermal-receipt-preview";

  // Handle print using print-utils
  const handlePrint = useCallback(() => {
    setIsPrinting(true);
    try {
      printReceipt(receiptElementId, paperSize);
      toast.success("Print dialog opened");
    } catch (err) {
      console.error("[PrintDialog] Print failed:", err);
      toast.error("Failed to open print dialog");
    }
    setTimeout(() => {
      setIsPrinting(false);
      onPrintComplete?.();
    }, 1500);
  }, [paperSize, onPrintComplete]);

  // Download as text
  const handleDownloadText = useCallback(() => {
    const receipt = generateThermalReceipt({
      orderNumber: order.orderNumber,
      date: `${order.date} ${order.time}`,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.rate,
        total: item.amount,
        gstRate: item.gstRate,
        hsnCode: item.hsnCode,
      })),
      subtotal: order.subtotal,
      totalTax: order.totalTax,
      totalAmount: order.totalAmount,
      cgst: order.cgst,
      sgst: order.sgst,
      igst: order.igst,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      packagingFee: order.packagingFee,
      convenienceFee: order.convenienceFee,
      roundOff: order.roundOff,
      businessName: business.name,
      businessAddress: store?.address || business.address,
      businessGst: business.gstNumber,
      businessPhone: store?.phone || business.phone,
      businessEmail: business.email,
      businessFssai: business.fssaiLicense,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerGst: order.customerGst,
      paymentMethod: order.paymentMethod,
      paperSize,
      taxBreakdown: order.taxBreakdown,
      amountInWords:
        order.amountInWords || numberToWords(Math.round(order.totalAmount)),
      footerMessage: `Thank you for shopping at ${business.name}!`,
    });

    const blob = new Blob([receipt.rawText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${order.orderNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded as text");
  }, [order, business, store, paperSize]);

  // Download as HTML
  const handleDownloadHTML = useCallback(() => {
    const html = generatePrintHTML(
      {
        ...order,
        time: order.time || "",
      },
      {
        name: business.name,
        address: store?.address || business.address,
        gstNumber: business.gstNumber,
        phone: store?.phone || business.phone,
        email: business.email,
        fssaiLicense: business.fssaiLicense,
        supportPhone: business.supportPhone,
        tagline: business.tagline,
        website: business.website,
      },
      paperSize
    );

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${order.orderNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded as HTML");
  }, [order, business, store, paperSize]);

  // Printer type config
  const printerTypeConfig: Record<
    PrinterType,
    { icon: typeof Printer; label: string; desc: string }
  > = {
    thermal_usb: {
      icon: Usb,
      label: "Thermal (USB)",
      desc: "USB thermal printer — 58mm/80mm",
    },
    thermal_bluetooth: {
      icon: Bluetooth,
      label: "Thermal (Bluetooth)",
      desc: "Bluetooth thermal printer",
    },
    laser: {
      icon: Monitor,
      label: "Laser / A4",
      desc: "Standard laser printer — A4 size",
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Print Receipt
          </DialogTitle>
          <DialogDescription>
            Configure and print the thermal receipt for {order.orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          {/* ── Left: Configuration ── */}
          <div className="space-y-4">
            {/* Paper Size Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Paper Size</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["58mm", "80mm", "A4"] as PaperSize[]).map((size) => {
                  const info = PAPER_SIZE_INFO[size];
                  const isSelected = paperSize === size;
                  return (
                    <Button
                      key={size}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`h-auto py-2 px-1 flex-col gap-0.5 ${
                        isSelected
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : ""
                      }`}
                      onClick={() => {
                        setPaperSize(size);
                        if (size === "A4") setPrinterType("laser");
                        else if (printerType === "laser")
                          setPrinterType("thermal_usb");
                      }}
                    >
                      <span className="text-xs font-bold">{size}</span>
                      <span
                        className={`text-[9px] ${
                          isSelected ? "text-emerald-100" : "text-muted-foreground"
                        }`}
                      >
                        {info.chars}
                      </span>
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {PAPER_SIZE_INFO[paperSize].desc}
              </p>
            </div>

            <Separator />

            {/* Printer Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Printer Type</Label>
              <Select
                value={printerType}
                onValueChange={(v) => setPrinterType(v as PrinterType)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(printerTypeConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          {config.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {printerTypeConfig[printerType].desc}
              </p>
            </div>

            <Separator />

            {/* QR Code Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Show QR Code</Label>
                <p className="text-xs text-muted-foreground">
                  Include QR code on receipt
                </p>
              </div>
              <Switch checked={showQR} onCheckedChange={setShowQR} />
            </div>

            {/* Quick Info */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              <p className="text-xs font-medium">Receipt Details</p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Bill: {order.orderNumber}</p>
                <p>Items: {order.items.length}</p>
                <p>Total: ₹{order.totalAmount.toFixed(2)}</p>
                <p>Payment: {order.paymentMethod || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* ── Right: Preview ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
              <Badge variant="outline" className="text-[9px] ml-1">
                {paperSize}
              </Badge>
            </Label>
            <ScrollArea className="h-[450px] rounded-lg border bg-muted/30 p-4">
              <ThermalReceiptV2
                order={order}
                business={business}
                store={store}
                paperSize={paperSize}
                showQR={showQR}
                className="mx-auto"
              />
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadText}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Text</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadHTML}
            className="gap-1.5"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">HTML</span>
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 min-w-[140px]"
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <>
                <span className="animate-spin">⏳</span>
                Printing...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                Print Receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
