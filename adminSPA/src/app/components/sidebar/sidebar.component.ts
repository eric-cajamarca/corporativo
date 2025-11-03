import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
//import { NgxSvgModule } from 'ngx-svg';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
   // Señales (Reactividad Angular 17+)
  flowers = signal<Flower[]>([]);
leaves = signal<Leaf[]>([]);
stems = signal<Stem[]>([]);
selectedColor = "#FF6B6B";
selectedElement: Flower | Leaf | null = null;
selectedStem: Stem | null = null; // Nuevo: Tallo seleccionado

constructor() {
  // Inicializar con un arreglo básico
  this.addStem();
}

// Generadores de formas
private generateFlower(x: number, y: number): Flower {
  const petals = `
    M${x},${y - 15} 
    C${x - 10},${y - 25} ${x - 20},${y - 15} ${x - 15},${y}
    C${x - 25},${y + 5} ${x - 10},${y + 15} ${x},${y + 10}
    C${x + 10},${y + 15} ${x + 25},${y + 5} ${x + 15},${y}
    C${x + 20},${y - 15} ${x + 10},${y - 25} ${x},${y - 15}
  `;
  return {
    path: petals,
    color: this.selectedColor,
    center: { x, y, radius: 3 }
  };
}

private generateLeaf(x: number, y: number): Leaf {
  return {
    path: `
      M${x},${y} 
      C${x - 15},${y - 5} ${x - 20},${y + 10} ${x - 5},${y + 15}
      C${x},${y + 20} ${x + 10},${y + 10} ${x + 5},${y}
      Z
    `,
    color: "#2e8b57"
  };
}

private generateStem(): Stem {
  const startY = 450;
  const endY = 250 + Math.random() * 100;
  return {
    path: `M300,${startY} C290,${startY - 50} 310,${endY + 50} 300,${endY}`,
    width: 3
  };
}

// Métodos de interacción
addFlower() {
  if (!this.selectedStem) {
    console.warn("No hay un tallo seleccionado para agregar la flor.");
    return;
  }
  // Posicionar la flor en el tallo seleccionado
  const x = 300; // Coordenada X fija para el tallo
  const y = 250 + Math.random() * 100; // Coordenada Y aleatoria dentro del rango del tallo
  this.flowers.update(f => [...f, this.generateFlower(x, y)]);
}

addLeaf() {
  if (!this.selectedStem) {
    console.warn("No hay un tallo seleccionado para agregar la hoja.");
    return;
  }
  // Posicionar la hoja en el tallo seleccionado
  const x = 300 + (Math.random() * 40 - 20); // Coordenada X cerca del tallo
  const y = 300 + Math.random() * 100; // Coordenada Y aleatoria dentro del rango del tallo
  this.leaves.update(l => [...l, this.generateLeaf(x, y)]);
}

addStem() {
  const newStem = this.generateStem();
  this.stems.update(s => [...s, newStem]);
  this.selectedStem = newStem; // Seleccionar automáticamente el nuevo tallo
}

selectElement(element: Flower | Leaf) {
  this.selectedElement = element;
  this.selectedColor = element.color;
}

selectStem(stem: Stem) {
  this.selectedStem = stem; // Seleccionar el tallo
}
}

// Interfaces para tipado
interface Flower {
  path: string;
  color: string;
  center?: { x: number; y: number; radius: number };
}

interface Leaf {
  path: string;
  color: string;
}

interface Stem {
  path: string;
  width: number;
}