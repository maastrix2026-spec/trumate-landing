/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/refs */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Upload,
  Loader2,
  ImagePlus,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";

/* ---------- Types ---------- */

type Category = { _id: string; name: string; slug?: string };

type ProductStatus = "Published" | "Draft" | "Out of Stock";

type VariantRow = {
  _id?: string;
  label: string;
  unitType: string;
  price: number | "";
  compareAtPrice: number | "";
  stock: number | "";
  sku: string;
  image: string;
  file: File | null;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  category: string;
  price: number | "";
  compareAtPrice: number | "";
  stock: number | "";
  sku: string;
  status: ProductStatus;
  isFeatured: boolean;
  image: string;
  gallery: string[];
  variants: VariantRow[];
};

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (productData: any) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productToEdit?: any | null;
  categories: Category[];
}

/* ---------- Constants & helpers ---------- */

const MAX_IMAGE_MB = 5;
const STATUS_OPTIONS: ProductStatus[] = ["Published", "Draft", "Out of Stock"];

const inputCls =
  "h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-[#1C3516] focus:ring-2 focus:ring-[#1C3516]/15 disabled:bg-stone-50 disabled:text-stone-500";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const emptyVariant = (): VariantRow => ({
  label: "",
  unitType: "",
  price: "",
  compareAtPrice: "",
  stock: 0,
  sku: "",
  image: "",
  file: null,
});

const emptyForm = (categoryId = ""): FormState => ({
  name: "",
  slug: "",
  description: "",
  category: categoryId,
  price: "",
  compareAtPrice: "",
  stock: "",
  sku: "",
  status: "Published",
  isFeatured: false,
  image: "",
  gallery: [],
  variants: [],
});

/** Creates object URLs for local files and revokes them when files change or on unmount. */
function useObjectUrls(files: File[]) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  return urls;
}

/** Returns an error message if the file isn't an acceptable image. */
function validateImage(file: File): string | null {
  if (!file.type.startsWith("image/")) return `"${file.name}" is not an image.`;
  if (file.size > MAX_IMAGE_MB * 1024 * 1024)
    return `"${file.name}" is larger than ${MAX_IMAGE_MB} MB.`;
  return null;
}

/* ---------- Component ---------- */

export default function ProductModal({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  categories,
}: ProductModalProps) {
  const [formData, setFormData] = useState<FormState>(emptyForm());
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  const mainFiles = useMemo(
    () => (mainImageFile ? [mainImageFile] : []),
    [mainImageFile],
  );
  const [mainObjectUrl] = useObjectUrls(mainFiles);
  const galleryObjectUrls = useObjectUrls(galleryFiles);
  const mainPreview = mainObjectUrl || formData.image;

  const variantFiles = useMemo(
    () =>
      formData.variants.map((v) => v.file).filter((f): f is File => f !== null),
    [formData.variants],
  );
  const variantObjectUrls = useObjectUrls(variantFiles);

  // Map each variant index to its local preview URL if a file is chosen
  const variantPreviewByIndex = useMemo(() => {
    const map = new Map<number, string>();
    let fileCursor = 0;
    formData.variants.forEach((v, idx) => {
      if (v.file) {
        map.set(idx, variantObjectUrls[fileCursor] || v.image || "");
        fileCursor += 1;
      } else if (v.image) {
        map.set(idx, v.image);
      }
    });
    return map;
  }, [formData.variants, variantObjectUrls]);

  /* Reset the form whenever the modal opens or the target product changes */
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setMainImageFile(null);
    setGalleryFiles([]);
    setSubmitting(false);

    if (productToEdit) {
      // Backward-compatible fallback for older docs that stored `images: string[]`
      const existingMain =
        productToEdit.image || productToEdit.images?.[0] || "";
      const existingGallery: string[] = Array.isArray(productToEdit.gallery)
        ? productToEdit.gallery
        : Array.isArray(productToEdit.images)
          ? productToEdit.images.slice(1)
          : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingVariants: VariantRow[] = Array.isArray(
        productToEdit.variants,
      )
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          productToEdit.variants.map((v: any) => ({
            _id: v._id,
            label: v.label || "",
            unitType: v.unitType || "",
            price: v.price ?? "",
            compareAtPrice: v.compareAtPrice ?? "",
            stock: v.stock ?? 0,
            sku: v.sku || "",
            image: v.image || "",
            file: null,
          }))
        : [];

      setSlugTouched(true);
      setFormData({
        name: productToEdit.name || "",
        slug: productToEdit.slug || "",
        description: productToEdit.description || "",
        category: productToEdit.category?._id || productToEdit.category || "",
        price: productToEdit.price ?? "",
        compareAtPrice: productToEdit.compareAtPrice ?? "",
        stock: productToEdit.stock ?? "",
        sku: productToEdit.sku || "",
        status: productToEdit.status || "Published",
        isFeatured: productToEdit.isFeatured || false,
        image: existingMain,
        gallery: existingGallery,
        variants: existingVariants,
      });
    } else {
      setSlugTouched(false);
      setFormData(emptyForm(categoriesRef.current[0]?._id || ""));
    }
  }, [productToEdit, isOpen]);

  /* Escape to close, lock background scroll while open */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, submitting, onClose]);

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const numberChange =
    (key: "price" | "compareAtPrice" | "stock") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update(key, e.target.value === "" ? "" : Number(e.target.value));

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name,
      slug: !productToEdit && !slugTouched ? slugify(name) : prev.slug,
    }));
  };

  /* ----- Image handling ----- */

  const pickMainImage = (file: File | undefined | null) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) return setError(problem);
    setError(null);
    setMainImageFile(file);
  };

  const addGalleryFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      const problem = validateImage(file);
      if (problem) {
        setError(problem);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) setGalleryFiles((prev) => [...prev, ...accepted]);
  };

  const removeSavedGalleryImage = (index: number) =>
    setFormData((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index),
    }));

  const removeNewGalleryFile = (index: number) =>
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));

  /* ----- Variant handling ----- */

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, emptyVariant()],
    }));
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariantField = <K extends keyof VariantRow>(
    index: number,
    key: K,
    value: VariantRow[K],
  ) => {
    setFormData((prev) => {
      const nextVariants = prev.variants.map((v, i) =>
        i === index ? { ...v, [key]: value } : v,
      );

      // Keep top-level price & stock synced when variants exist
      if (nextVariants.length > 0 && (key === "price" || key === "stock")) {
        const validPrices = nextVariants
          .map((v) => (v.price === "" ? null : Number(v.price)))
          .filter((p): p is number => p !== null && !Number.isNaN(p));
        const nextStock = nextVariants.reduce(
          (sum, v) => sum + (v.stock === "" ? 0 : Number(v.stock) || 0),
          0,
        );
        return {
          ...prev,
          variants: nextVariants,
          ...(validPrices.length > 0
            ? { price: Math.min(...validPrices) }
            : {}),
          stock: nextStock,
        };
      }

      return { ...prev, variants: nextVariants };
    });
  };

  const pickVariantImage = (index: number, file: File | undefined | null) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) return setError(problem);
    setError(null);
    updateVariantField(index, "file", file);
  };

  /* ----- Derived hints ----- */

  const hasVariants = formData.variants.length > 0;
  const price = formData.price === "" ? null : formData.price;
  const compare =
    formData.compareAtPrice === "" ? null : formData.compareAtPrice;
  const discount =
    price !== null && compare !== null && compare > price && compare > 0
      ? Math.round(((compare - price) / compare) * 100)
      : 0;
  const compareInvalid =
    price !== null && compare !== null && compare > 0 && compare <= price;

  /* ----- Submit ----- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!mainImageFile && !formData.image) {
      setError("Add a main product image before saving.");
      return;
    }
    if (compareInvalid) {
      setError(
        "Compare price must be higher than the selling price, or left empty.",
      );
      return;
    }

    for (let i = 0; i < formData.variants.length; i++) {
      const v = formData.variants[i];
      if (!v.label.trim()) {
        setError(
          `Variant #${i + 1} needs a label (e.g. 1L, Medium, 1 Bundle).`,
        );
        return;
      }
      if (v.price === "" || Number(v.price) < 0) {
        setError(`Variant "${v.label}" needs a valid selling price.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const finalImageUrl = mainImageFile
        ? await uploadToCloudinary(mainImageFile)
        : formData.image;

      const uploadedGallery = galleryFiles.length
        ? await Promise.all(galleryFiles.map((f) => uploadToCloudinary(f)))
        : [];

      // Upload any per-variant image files to Cloudinary before saving
      const processedVariants = await Promise.all(
        formData.variants.map(async (v) => {
          const variantImageUrl = v.file
            ? await uploadToCloudinary(v.file)
            : v.image || undefined;

          return {
            ...(v._id ? { _id: v._id } : {}),
            label: v.label.trim(),
            unitType: v.unitType.trim() || undefined,
            price: Number(v.price),
            compareAtPrice:
              v.compareAtPrice === "" ? undefined : Number(v.compareAtPrice),
            stock: v.stock === "" ? 0 : Number(v.stock),
            sku: v.sku.trim() || undefined,
            image: variantImageUrl,
          };
        }),
      );

      const syncedPrice =
        processedVariants.length > 0
          ? Math.min(...processedVariants.map((v) => v.price))
          : formData.price;

      const syncedStock =
        processedVariants.length > 0
          ? processedVariants.reduce((sum, v) => sum + v.stock, 0)
          : formData.stock;

      // Strip local `file` properties from variants before sending to onSave
      const { variants: _ignored, ...restForm } = formData;
      void _ignored;

      await onSave({
        ...restForm,
        price: syncedPrice,
        stock: syncedStock,
        image: finalImageUrl,
        gallery: [...formData.gallery, ...uploadedGallery],
        variants: processedVariants,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save product", err);
      setError(
        (err as Error)?.message ||
          "We couldn't upload the images or save the product.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isEditing = Boolean(productToEdit);
  const totalGallery = formData.gallery.length + galleryFiles.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-0 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="flex h-full w-full flex-col overflow-hidden bg-stone-50 shadow-2xl sm:h-auto sm:max-h-[min(92vh,860px)] sm:max-w-4xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2
              id="product-modal-title"
              className="text-lg font-semibold text-stone-900"
            >
              {isEditing ? "Edit product" : "Add product"}
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">
              {isEditing
                ? "Changes appear on the storefront as soon as you save."
                : "Fill in the details below. Fields marked * are required."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="-mr-1 cursor-pointer rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <form
          id="product-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-6"
        >
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            {/* Left column */}
            <div className="space-y-5">
              <Section title="Basic information">
                <Field label="Product name" required htmlFor="pm-name">
                  <input
                    id="pm-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleNameChange}
                    className={inputCls}
                    placeholder="e.g. Eco surface cleaner or 8-inch bagasse plate"
                  />
                </Field>

                <Field
                  label="URL slug"
                  required
                  htmlFor="pm-slug"
                  hint="Used in the product link. Lowercase letters, numbers and hyphens."
                >
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 px-3 text-sm text-stone-500">
                      /products/
                    </span>
                    <input
                      id="pm-slug"
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        update("slug", slugify(e.target.value));
                      }}
                      className={`${inputCls} rounded-l-none`}
                    />
                  </div>
                </Field>

                <Field label="Category" required htmlFor="pm-category">
                  <select
                    id="pm-category"
                    required
                    value={formData.category}
                    onChange={(e) => update("category", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Description" required htmlFor="pm-desc">
                  <textarea
                    id="pm-desc"
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => update("description", e.target.value)}
                    className={`${inputCls} h-auto resize-y py-2.5 leading-6`}
                    placeholder="Material, size, pack quantity and typical use."
                  />
                  <p className="mt-1 text-right text-xs text-stone-400">
                    {formData.description.length} characters
                  </p>
                </Field>
              </Section>

              <Section title="Pricing and inventory">
                {hasVariants && (
                  <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600 ring-1 ring-stone-200">
                    Selling price and stock are auto-synced from your variants
                    below (lowest price &amp; total stock).
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Selling price" required htmlFor="pm-price">
                    <CurrencyInput
                      id="pm-price"
                      required
                      disabled={hasVariants}
                      value={formData.price}
                      onChange={numberChange("price")}
                    />
                  </Field>
                  <Field
                    label="Compare-at price"
                    htmlFor="pm-compare"
                    hint={
                      discount > 0
                        ? `Shows a ${discount}% discount on the storefront.`
                        : "The original price, shown struck through."
                    }
                    error={
                      compareInvalid
                        ? "Must be higher than the selling price."
                        : undefined
                    }
                  >
                    <CurrencyInput
                      id="pm-compare"
                      value={formData.compareAtPrice}
                      onChange={numberChange("compareAtPrice")}
                      invalid={compareInvalid}
                    />
                  </Field>
                  <Field label="Stock quantity" required htmlFor="pm-stock">
                    <input
                      id="pm-stock"
                      type="number"
                      required
                      disabled={hasVariants}
                      min="0"
                      inputMode="numeric"
                      value={formData.stock}
                      onChange={numberChange("stock")}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="SKU" htmlFor="pm-sku">
                    <input
                      id="pm-sku"
                      type="text"
                      value={formData.sku}
                      onChange={(e) => update("sku", e.target.value)}
                      className={inputCls}
                      placeholder="e.g. TRU-PLT-08"
                    />
                  </Field>
                </div>
              </Section>

              {/* Sizes / Units / Packaging Variants */}
              <Section title="Sizes, units & packaging variants">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-stone-500">
                    Optional. Add options like{" "}
                    <span className="font-medium text-stone-700">
                      1L / 5L / 10L
                    </span>
                    ,{" "}
                    <span className="font-medium text-stone-700">
                      Small / Medium / Big
                    </span>
                    , or{" "}
                    <span className="font-medium text-stone-700">1 Bundle</span>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 text-xs font-medium text-stone-800 transition-colors hover:bg-stone-50"
                  >
                    <Plus className="size-3.5" />
                    Add variant
                  </button>
                </div>

                {formData.variants.length > 0 && (
                  <div className="space-y-3">
                    {formData.variants.map((variant, idx) => {
                      const previewSrc = variantPreviewByIndex.get(idx);
                      return (
                        <div
                          key={variant._id || `variant-${idx}`}
                          className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-700">
                              Variant #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeVariant(idx)}
                              aria-label={`Remove variant ${idx + 1}`}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-3.5" />
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-stone-700">
                                Option / Size label{" "}
                                <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                value={variant.label}
                                onChange={(e) =>
                                  updateVariantField(
                                    idx,
                                    "label",
                                    e.target.value,
                                  )
                                }
                                className={inputCls}
                                placeholder="e.g. 1L, 5L, Medium, 1 Bundle"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-stone-700">
                                Unit type
                              </label>
                              <input
                                type="text"
                                value={variant.unitType}
                                onChange={(e) =>
                                  updateVariantField(
                                    idx,
                                    "unitType",
                                    e.target.value,
                                  )
                                }
                                className={inputCls}
                                placeholder="e.g. Volume, Size, Pack"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-stone-700">
                                Price (₹){" "}
                                <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="number"
                                required
                                min="0"
                                step="any"
                                value={variant.price}
                                onChange={(e) =>
                                  updateVariantField(
                                    idx,
                                    "price",
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value),
                                  )
                                }
                                className={inputCls}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-stone-700">
                                Compare price (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={variant.compareAtPrice}
                                onChange={(e) =>
                                  updateVariantField(
                                    idx,
                                    "compareAtPrice",
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value),
                                  )
                                }
                                className={inputCls}
                                placeholder="Optional"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-stone-700">
                                Stock <span className="text-red-600">*</span>
                              </label>
                              <input
                                type="number"
                                required
                                min="0"
                                value={variant.stock}
                                onChange={(e) =>
                                  updateVariantField(
                                    idx,
                                    "stock",
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value),
                                  )
                                }
                                className={inputCls}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-stone-700">
                                Variant SKU
                              </label>
                              <input
                                type="text"
                                value={variant.sku}
                                onChange={(e) =>
                                  updateVariantField(idx, "sku", e.target.value)
                                }
                                className={inputCls}
                                placeholder="e.g. TRU-CLN-5L"
                              />
                            </div>
                          </div>

                          {/* Variant Image Upload */}
                          <div className="flex items-center gap-3 pt-1">
                            {previewSrc ? (
                              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={previewSrc}
                                  alt={variant.label || `Variant ${idx + 1}`}
                                  className="h-full w-full object-contain p-1"
                                />
                              </div>
                            ) : (
                              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white text-stone-400">
                                <ImagePlus className="size-5" />
                              </div>
                            )}

                            <div className="flex flex-1 flex-wrap items-center gap-2">
                              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100">
                                <Upload className="size-3.5" />
                                {variant.file
                                  ? variant.file.name
                                  : previewSrc
                                    ? "Change image"
                                    : "Variant image"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    pickVariantImage(idx, e.target.files?.[0]);
                                    e.target.value = "";
                                  }}
                                />
                              </label>

                              {(variant.file || variant.image) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateVariantField(idx, "file", null);
                                    updateVariantField(idx, "image", "");
                                  }}
                                  className="h-8 cursor-pointer rounded-lg px-2 text-xs text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-800"
                                >
                                  Clear image
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              <Section title="Visibility">
                <Field label="Status" htmlFor="pm-status-group">
                  <div
                    id="pm-status-group"
                    role="radiogroup"
                    aria-label="Status"
                    className="grid grid-cols-3 gap-1 rounded-lg bg-stone-100 p-1"
                  >
                    {STATUS_OPTIONS.map((opt) => {
                      const active = formData.status === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => update("status", opt)}
                          className={`cursor-pointer rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? "bg-white text-stone-900 shadow-sm"
                              : "text-stone-500 hover:text-stone-800"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => update("isFeatured", e.target.checked)}
                    className="mt-0.5 size-4 cursor-pointer rounded border-stone-300 accent-[#1C3516]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-stone-800">
                      Feature on homepage
                    </span>
                    <span className="block text-xs text-stone-500">
                      Featured products are listed first in the catalog.
                    </span>
                  </span>
                </label>
              </Section>

              <Section title="Images">
                {/* Main image */}
                <div>
                  <p className="mb-1.5 text-sm font-medium text-stone-800">
                    Main image <span className="text-red-600">*</span>
                  </p>

                  {mainPreview ? (
                    <div className="space-y-2">
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mainPreview}
                          alt="Main product preview"
                          className="h-full w-full object-contain p-3"
                        />
                        {mainImageFile && (
                          <span className="absolute left-2 top-2 rounded-md bg-[#1C3516] px-2 py-0.5 text-xs font-medium text-white">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <label className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50">
                          <Upload className="size-4" />
                          Replace
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              pickMainImage(e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {mainImageFile && (
                          <button
                            type="button"
                            onClick={() => setMainImageFile(null)}
                            className="h-9 cursor-pointer rounded-lg px-3 text-sm text-stone-600 transition-colors hover:bg-stone-100"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        pickMainImage(e.dataTransfer.files?.[0]);
                      }}
                      className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center transition-colors ${
                        dragging
                          ? "border-[#1C3516] bg-[#1C3516]/5"
                          : "border-stone-300 bg-white hover:bg-stone-50"
                      }`}
                    >
                      <ImagePlus className="size-7 text-stone-400" />
                      <span className="text-sm font-medium text-stone-700">
                        Drop an image or click to browse
                      </span>
                      <span className="text-xs text-stone-500">
                        JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          pickMainImage(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Gallery */}
                <div>
                  <p className="mb-1.5 text-sm font-medium text-stone-800">
                    Gallery{" "}
                    <span className="font-normal text-stone-500">
                      ({totalGallery})
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {formData.gallery.map((url, idx) => (
                      <Thumb
                        key={`saved-${url}-${idx}`}
                        src={url}
                        alt={`Gallery image ${idx + 1}`}
                        onRemove={() => removeSavedGalleryImage(idx)}
                      />
                    ))}
                    {galleryFiles.map((file, idx) => (
                      <Thumb
                        key={`new-${file.name}-${idx}`}
                        src={galleryObjectUrls[idx]}
                        alt={file.name}
                        isNew
                        onRemove={() => removeNewGalleryFile(idx)}
                      />
                    ))}
                    <label
                      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 bg-white text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
                      title="Add gallery images"
                    >
                      <Plus className="size-5" />
                      <span className="text-xs">Add</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addGalleryFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-stone-200 bg-white px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 cursor-pointer rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={submitting}
            className="inline-flex h-10 min-w-36 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1C3516] px-5 text-sm font-medium text-white transition-colors hover:bg-[#244620] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Create product"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Small building blocks ---------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-semibold text-stone-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-stone-800"
      >
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

function CurrencyInput({
  id,
  value,
  onChange,
  required,
  invalid,
  disabled,
}: {
  id: string;
  value: number | "";
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">
        ₹
      </span>
      <input
        id={id}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        required={required}
        disabled={disabled}
        value={value}
        onChange={onChange}
        aria-invalid={invalid}
        className={`${inputCls} pl-7 ${
          invalid
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
            : ""
        }`}
      />
    </div>
  );
}

function Thumb({
  src,
  alt,
  isNew,
  onRemove,
}: {
  src?: string;
  alt: string;
  isNew?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-white">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain p-1.5"
        />
      )}
      {isNew && (
        <span className="absolute bottom-1 left-1 rounded bg-[#1C3516] px-1.5 py-0.5 text-[10px] font-medium text-white">
          New
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${alt}`}
        className="absolute right-1 top-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-white/95 text-stone-600 shadow ring-1 ring-stone-200 transition-colors hover:text-red-600 focus-visible:outline-2 focus-visible:outline-[#1C3516]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
