from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship



class ImageProduct(db.Model):
    __tablename__ = "image_products"
    image_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    image_data = db.Column(db.Text, nullable=False)
    product_id = db.Column(db.Integer, ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False)
    
    product = relationship("Product", back_populates="image", lazy=True)

    def __repr__(self):
        return f'<ImageProduct {self.image_id} {self.image_data} {self.product_id}>'
    
    def to_dict(self):
        return {
            'image_id': self.image_id,
            'image_str': self.image_data,
            'product_id': self.product_id,
        }