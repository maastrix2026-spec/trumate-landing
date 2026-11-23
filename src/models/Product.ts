import mongoose, { Schema, Document, models } from "mongoose";
import "./Category";

export interface IProductVariant {
  _id?: mongoose.Types.ObjectId;
  label: string;          
  unitType?: string;       
  price: number;
  compareAtPrice?: number;
  stock: number;
  sku?: string;
  image?: string;        
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  category: mongoose.Types.ObjectId;
  price: number;           // Base / default price (still works for existing products)
  compareAtPrice?: number;
  stock: number;           // Base / total stock (still works for existing products)
  sku?: string;
  image: string;
  gallery: string[];
  variants: IProductVariant[];
  status: "Draft" | "Published" | "Out of Stock";
  isFeatured: boolean;
  createdAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
  label: { type: String, required: true, trim: true }, // "1L", "5L", "Medium", "1 Bundle"
  unitType: { type: String, trim: true },              // Optional: "Volume", "Size", "Packaging"
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  stock: { type: Number, required: true, default: 0, min: 0 },
  sku: { type: String, trim: true },
  image: { type: String },
});

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  stock: { type: Number, required: true, default: 0, min: 0 },
  sku: { type: String, unique: true, sparse: true },
  image: { type: String, required: true },
  gallery: [{ type: String }],
  variants: {
    type: [ProductVariantSchema],
    default: [], // Existing documents automatically default to [] without migration
  },
  status: {
    type: String,
    enum: ["Draft", "Published", "Out of Stock"],
    default: "Published",
  },
  isFeatured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default models.Product || mongoose.model<IProduct>("Product", ProductSchema);