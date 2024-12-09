from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship




class Product(db.Model):
    __tablename__= "products"
    product_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    product_name = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Integer, nullable=False)
    unit = db.Column(db.String(120), nullable=False)
    stock = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    status = db.Column(db.String(20), nullable=True, default='active')
    shop_id = db.Column(db.Integer, ForeignKey('shops.shop_id', ondelete='CASCADE'), nullable=False)
    category_id = db.Column(db.Integer, ForeignKey('categories.category_id'), nullable=True)

    
    shop = relationship("Shop", back_populates="product", lazy=True)

    #relasi ke Category
    category = relationship("Category", back_populates="product", lazy=True)

    #relasi ke TagProductAssociation
    tag_product = relationship("TagProductAssociation", back_populates="product",cascade="all, delete", lazy=True)
    

    #akses ke image
    image = relationship("ImageProduct", back_populates="product", cascade="all, delete", lazy=True)

    #akses ke variant
    variant = relationship("Variant", back_populates="product", cascade="all, delete", lazy=True)

    def __repr__(self):
        return f'<Product {self.product_id} {self.product_name} {self.description}>'
    
    def to_dict(self):
        return {
            'product_id': self.product_id,
            'product_name': self.product_name,
            'description': self.description,
            'price': self.price,
            'unit': self.unit,
            'created_at': self.created_at,
            'status': self.status,
            'shop_id': self.shop_id,
            'category_id': self.category_id
        }
    
    
