from time import time
from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    email = f"prueba-integrada-{int(time())}@example.com"
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    assert page.get_by_text("El board de quienes").is_visible()

    page.get_by_label("Navegación principal").get_by_role("button", name="Crear mi tarjeta").click()
    page.get_by_role("button", name="No tengo cuenta todavía").click()
    page.get_by_role("textbox", name="Nombre").fill("Prueba")
    page.get_by_role("textbox", name="Apellido").fill("Integrada")
    page.get_by_role("textbox", name="Correo").fill(email)
    page.get_by_role("textbox", name="Contraseña").fill("una-clave-segura-2026")
    page.get_by_role("button", name="Crear cuenta").click()
    page.wait_for_timeout(1000)
    assert not page.locator(".form-error").count(), page.locator(".form-error").all_text_contents()
    assert page.get_by_text("Tu correo todavía no está confirmado.").is_visible()
    page.get_by_role("textbox", name="Nombre").fill("Prueba")
    page.get_by_role("textbox", name="Apellido").fill("Integrada")
    page.get_by_label("Presentación").fill("Perfil creado durante una prueba integrada del flujo público.")
    assert page.get_by_label("Publicar ahora").is_disabled()
    page.get_by_role("button", name="Guardar perfil").click()
    page.wait_for_timeout(500)
    assert page.get_by_text("Guardamos tu perfil como borrador.").is_visible()

    page.goto("http://127.0.0.1:5173/verify-email?token=invalid", wait_until="networkidle")
    assert page.get_by_text("No pudimos confirmar el correo").is_visible()
    assert page.get_by_role("link", name="Ir a mi perfil").is_visible()
    page.screenshot(path="/tmp/yodev-smoke.png", full_page=True)
    browser.close()
