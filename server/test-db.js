import puppeteer from "puppeteer";
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Forward browser console to terminal
  page.on("console", msg => console.log("BROWSER:", msg.text()));

  await page.goto("http://127.0.0.1:5173/");

  // Run the test inside the browser context
  const success = await page.evaluate(async () => {
    try {
      const repo = await import("/src/db/repo.ts");
      
      console.log("Creating project...");
      const p = await repo.createProject("Test Project", "landscape");
      if (!p || p.name !== "Test Project") throw new Error("Project creation failed");
      
      console.log("Adding images...");
      await repo.putImage({ projectId: p.id, source: "upload", blob: new Blob(["fake image"]) });
      await repo.putImage({ projectId: p.id, source: "upload", blob: new Blob(["fake image 2"]) });
      
      let imgs = await repo.listProjectImages(p.id);
      if (imgs.length !== 2) throw new Error("Images not saved");
      
      console.log("Testing cascade delete...");
      await repo.deleteProject(p.id);
      
      imgs = await repo.listProjectImages(p.id);
      if (imgs.length !== 0) throw new Error("Images were not deleted during cascade delete");
      
      console.log("Creating style group...");
      const sg = await repo.createStyleGroup("Test Style");
      await repo.renameStyleGroup(sg.id, "Renamed Style");
      
      const styles = await repo.listStyleGroups();
      if (!styles.find(s => s.id === sg.id && s.name === "Renamed Style")) throw new Error("Style group rename failed");
      
      console.log("All DB Tests Passed!");
      return true;
    } catch (err) {
      console.error(err.message);
      return false;
    }
  });

  await browser.close();
  if (success) {
    console.log("TEST_SUCCESS");
    process.exit(0);
  } else {
    console.error("TEST_FAILED");
    process.exit(1);
  }
})();

