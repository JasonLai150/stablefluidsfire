@group(0) @binding(0) var divergenceTexture: texture_2d<f32>;
@group(0) @binding(1) var pressureTexture: texture_2d<f32>;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;
    
    let divergence = textureLoad(divergenceTexture, id.xy, 0).x;
    let pRight = textureLoad(pressureTexture, vec2<u32>(x+1, y), 0).x;
    let pLeft = textureLoad(pressureTexture, vec2<u32>(x-1, y), 0).x;
    let pTop = textureLoad(pressureTexture, vec2<u32>(x, y+1), 0).x;
    let pBottom = textureLoad(pressureTexture, vec2<u32>(x, y-1), 0).x;
    
    let pressure = (pRight + pLeft + pTop + pBottom - divergence) * 0.25;
    textureStore(outputTexture, id.xy, vec4<f32>(pressure, 0.0, 0.0, 1.0));
}