import mongoose from "mongoose";

const mascotaSchema = new mongoose.Schema({
  nombre: String,
  estado: String,
  raza: String,
  edad: String,
  genero: String,
  enfermedades: String,
  historial: String,
  imagen: String,
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
});



export default mongoose.model("Mascota", mascotaSchema);
