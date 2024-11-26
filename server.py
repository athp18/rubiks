from flask import Flask, request, jsonify
import kociemba
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/solve', methods=['POST'])
def solve_cube():
    try:
        data = request.json
        cube_state = data.get('cubeState', '')

        # Validate cube state
        if len(cube_state) != 54:
            raise ValueError("Cube string must have exactly 54 characters.")

        if sorted(cube_state) != sorted("UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"):
            raise ValueError("Cube string does not represent a valid Rubik's Cube.")

        # Solve the cube
        solution = kociemba.solve(cube_state)
        return jsonify({'solution': solution})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)