<div align="center">
  <h1>Organic Buoyancy Solver</h1>
  <p><strong>Real-time hydrostatic equilibrium solver for arbitrary 3D meshes</strong></p>
</div>

A powerful web-based simulation tool built with **React**, **Three.js**, and **TypeScript** that calculates and visualizes the flotation stability of 3D objects in real-time. 

Unlike simple bounding-box approximations, this solver performs **actual geometry slicing** 60 times per second to calculate precise submerged volumes, Center of Buoyancy (COB), and Center of Gravity (COG), allowing for accurate simulation of trim, heel, and draft.

## ✨ Key Features

*   **🌊 Accurate Hydrostatics**: Real-time calculation of submerged volume, water plane area, and buoyancy forces using geometric clipping.
*   **🏗️ 3D Import**: Drag and drop `.stl` files for your hull or object. Supports unit scaling (m, cm, mm, in, ft).
*   **⚖️ External Loads**: Add dynamic external weights to simulate cargo, ballast, or equipment. 
    *   Position weights in 3D space.
    *   Visualize them as simple volumes or import custom `.stl` meshes for them.
*   **📊 Live Physics Data**:
    *   Monitor **Draft** (Sinkage), **Heel** (Roll), and **Trim** (Pitch).
    *   Visual indicators for Center of Gravity (Green) and Center of Buoyancy (Blue).
    *   Stability warnings when the object is sinking or unstable.
*   **🎛️ Interactive Configuration**:
    *   Adjust material density (e.g., wood, foam, steel).
    *   Adjust fluid density (freshwater, seawater).

## 🛠️ Technology Stack

*   **Framework**: React (Vite)
*   **Language**: TypeScript
*   **3D Engine**: Three.js / @react-three/fiber / @react-three/drei
*   **Styling**: TailwindCSS (via utility classes)

## 🚀 Getting Started

No API keys or external services are required. The physics engine runs entirely client-side.

### Prerequisites

*   Node.js (v16 or higher recommended)

### Installation

1.  Clone the repository and enter the directory:
    ```bash
    git clone <repository-url>
    cd organic-buoyancy-solver
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser at `http://localhost:3000` (or the port shown in the terminal).

## 🎮 How to Use

1.  **Import Object**: Click "Select .stl file" in the sidebar to load your main hull/object.
2.  **Set Density**: Adjust the "Material Density" to match your object (e.g., 500 kg/m³ for wood).
3.  **Add Weights**: Use the "2. External Loads" section to add simulated weights (like engines or cargo). You can adjust their mass and position using the input fields.
4.  **Observe**: Watch the 3D scene. The object will settle into equilibrium. 
    *   If the **Green Dot** (COG) is vertically aligned with the **Blue Dot** (COB), the object is stable.
    *   Use the "Solver Status" panel to read precise values.

## 📝 License

[MIT](LICENSE)
